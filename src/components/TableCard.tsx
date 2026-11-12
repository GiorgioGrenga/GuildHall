import { useState } from 'react'
import { Check, EyeOff, MoreHorizontal, Pencil, ShieldCheck, Sparkles, X } from 'lucide-react'
import type { GameTable, User } from '../types'

interface TableCardProps {
  table: GameTable
  users: User[]
  currentUser: User
  canManageTable: boolean
  accent: number
  onSeat: (seatNumber: number) => void
  onLeave: () => void
  onEdit: () => void
  onDelete: () => void
}

export function TableCard({ table, users, currentUser, canManageTable, accent, onSeat, onLeave, onEdit, onDelete }: TableCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const mySeat = table.seats.find((seat) => seat.userId === currentUser.id)
  const master = users.find((user) => user.id === table.masterUserId) ?? users.find((user) => user.role === 'master')
  const full = table.seats.length >= table.maxSeats
  const available = table.maxSeats - table.seats.length

  return (
    <article className={`table-card table-accent-${accent}`}>
      <div className="table-cover">
        <img src={table.imageUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />
        <div className="cover-overlay" />
        <span className="table-number">{table.name.split('·')[0].trim()}</span>
        {canManageTable && (
          <div className="table-admin-menu">
            <button type="button" className="table-menu-trigger" aria-label="Opzioni tavolo" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={19} /></button>
            {menuOpen && <div className="table-menu"><button type="button" onClick={() => { setMenuOpen(false); onEdit() }}><Pencil size={14} /> Modifica tavolo</button><button type="button" className="delete-action" onClick={() => { setMenuOpen(false); if (window.confirm(`Eliminare “${table.name}”?`)) onDelete() }}><X size={14} /> Elimina tavolo</button></div>}
          </div>
        )}
        <div className="cover-caption"><span className="cover-spark"><Sparkles size={13} /></span> TAVOLO APERTO</div>
      </div>
      <div className="table-card-content">
        <div className="table-system-pill"><span />{table.system}</div>
        <h3>{table.adventureTitle}</h3>
        <p className="table-notes">{table.notes}</p>
        <div className="seat-section">
          <div className="seat-heading"><span>PRENOTA IL TUO POSTO</span><b className={full ? 'seats-full' : ''}>{available === 1 ? '1 posto libero' : `${available} posti liberi`}</b></div>
          <div className="seat-dots" role="group" aria-label={`Posti al ${table.name}`}>
            {Array.from({ length: table.maxSeats }, (_, index) => {
              const seatNumber = index + 1
              const booking = table.seats.find((seat) => seat.seatNumber === seatNumber)
              const player = booking ? users.find((user) => user.id === booking.userId) : undefined
              const isMine = booking?.userId === currentUser.id
              const label = booking
                ? booking.anonymous && !canManageTable ? 'Giocatore Misterioso' : booking.anonymous ? `Anonimo (${player?.name ?? 'giocatore'})` : player?.name ?? 'Giocatore'
                : `Posto ${seatNumber} libero`
              return (
                <button
                  type="button"
                  key={seatNumber}
                  className={`seat-dot ${booking ? 'occupied' : 'empty'} ${booking?.anonymous ? 'anonymous-seat' : ''} ${isMine ? 'my-seat' : ''}`}
                  disabled={Boolean(booking && !isMine && !canManageTable)}
                  onClick={() => booking ? isMine ? onLeave() : onSeat(seatNumber) : onSeat(seatNumber)}
                  aria-label={isMine ? `Il tuo posto ${seatNumber}, libera posto` : label}
                  title={label}
                >
                  {booking?.anonymous && <EyeOff size={12} />}
                  {booking && !booking.anonymous && <span>{player?.name.charAt(0).toUpperCase() ?? '?'}</span>}
                  <span className="seat-tooltip">{label}</span>
                </button>
              )
            })}
          </div>
          <div className="seat-players">
            {table.seats.map((seat) => {
              const player = users.find((user) => user.id === seat.userId)
              const label = seat.anonymous && !canManageTable ? 'Giocatore Misterioso' : seat.anonymous ? `Anonimo (${player?.name ?? 'giocatore'})` : player?.name ?? 'Giocatore'
              return <span className="seat-player-chip" key={seat.id}><i style={{ backgroundColor: player?.color ?? '#8c7cb5' }} />{label}</span>
            })}
            {!table.seats.length && <span className="no-one-seated">Nessun avventuriero ancora seduto</span>}
          </div>
        </div>
        <div className="table-card-footer">
          <div className="table-host"><span className="host-avatar"><ShieldCheck size={14} /></span><span><small>{table.masterUserId ? 'MASTER DEL TAVOLO' : 'GESTITO DA'}</small><b>{master?.name ?? 'Proprietario'}</b></span></div>
          {mySeat ? (
            <button type="button" className="leave-seat-button" onClick={onLeave}><Check size={14} /> Sei seduto <span>·</span> Alzati</button>
          ) : (
            <button type="button" className="sit-button" disabled={full} onClick={() => onSeat(Array.from({ length: table.maxSeats }, (_, index) => index + 1).find((number) => !table.seats.some((seat) => seat.seatNumber === number)) ?? 1)}>
              {full ? 'Tavolo completo' : <>Siediti al tavolo <span>↗</span></>}
            </button>
          )}
        </div>
        {mySeat?.anonymous && <div className="anonymous-note"><EyeOff size={12} /> Ti vedono come giocatore misterioso</div>}
      </div>
    </article>
  )
}
