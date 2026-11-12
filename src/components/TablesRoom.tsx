import { useState } from 'react'
import { Compass, Dices, Plus, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import type { GameRoom, GameTable, User } from '../types'
import { useApp } from '../store/useApp'
import { TableCard } from './TableCard'

interface TablesRoomProps {
  tables: GameTable[]
  rooms: GameRoom[]
  selectedRoomId: string
  selectedDate: string
  onSelectDate: (date: string) => void
  onSelectRoom: (roomId: string) => void
  onCreateRoom: () => void
  users: User[]
  currentUser: User
  isMaster: boolean
  onCreate: () => void
  onEdit: (table: GameTable) => void
  onDelete: (tableId: string) => void
}

export function TablesRoom({ tables, rooms, selectedRoomId, selectedDate, onSelectDate, onSelectRoom, onCreateRoom, users, currentUser, isMaster, onCreate, onEdit, onDelete }: TablesRoomProps) {
  const { toggleSeat } = useApp()
  const [anonymous, setAnonymous] = useState(false)
  const occupied = tables.reduce((count, table) => count + table.seats.length, 0)
  const available = tables.reduce((count, table) => count + table.maxSeats - table.seats.length, 0)
  const myBookings = tables.filter((table) => table.seats.some((seat) => seat.userId === currentUser.id)).length

  return (
    <div className="tables-page">
      <div className="page-heading table-page-heading">
        <div>
          <div className="page-kicker"><span className="kicker-line" /> IL DADO È TRATTO</div>
          <h1>La Sala <span>Tavoli.</span></h1>
          <p>Trova la tua prossima avventura. Scegli un posto e preparati a giocare.</p>
        </div>
        {isMaster && selectedRoomId ? (
          <button type="button" className="button-primary" onClick={onCreate}><Plus size={17} /> Crea un tavolo</button>
        ) : !isMaster ? (
          <label className="anonymous-toggle"><span className={anonymous ? 'toggle-switch enabled' : 'toggle-switch'}><i /></span><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /><span><b>Prenota anonimamente</b><small>Il tuo nome resterà nascosto ai giocatori</small></span></label>
        ) : null}
      </div>
      <div className="table-stats">
        <div className="table-stat"><span className="table-stat-icon violet"><Dices size={17} /></span><span><b>{tables.length}</b><small>TAVOLI APERTI</small></span></div>
        <div className="table-stat"><span className="table-stat-icon green"><Users size={17} /></span><span><b>{occupied}</b><small>AVVENTURIERI SEDUTI</small></span></div>
        <div className="table-stat"><span className="table-stat-icon amber"><Compass size={17} /></span><span><b>{available}</b><small>POSTI DISPONIBILI</small></span></div>
        <div className="tables-live"><span className="live-dot" /> LIVE <span>·</span> Aggiornato ora</div>
      </div>
      <div className="tables-section-heading">
        <div><div className="table-section-kicker"><Sparkles size={13} /> AVVENTURE IN CORSO</div><h2>Scegli il tuo tavolo</h2></div>
        <div className="room-actions">
          <label className="room-select-label"><span>DATA</span><input aria-label="Seleziona data della sala" type="date" value={selectedDate} onChange={(event) => onSelectDate(event.target.value)} /></label>
          {rooms.length > 0 && <label className="room-select-label"><SlidersHorizontal size={15} /><select aria-label="Seleziona sala" value={selectedRoomId} onChange={(event) => onSelectRoom(event.target.value)}>{rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>}
          {isMaster && <button type="button" className="filter-button" onClick={onCreateRoom}><Plus size={15} /> Crea sala</button>}
        </div>
      </div>
      {tables.length ? (
        <div className="table-grid">
          {tables.map((table, index) => <TableCard key={table.id} table={table} users={users} currentUser={currentUser} canManageTable={isMaster || table.masterUserId === currentUser.id} accent={index % 3} onSeat={(seatNumber) => void toggleSeat(table.id, seatNumber, anonymous)} onLeave={() => void toggleSeat(table.id, 0, anonymous)} onEdit={() => onEdit(table)} onDelete={() => onDelete(table.id)} />)}
        </div>
      ) : (
        <div className="empty-tables"><span><Dices size={24} /></span><b>Nessuna sala per questa data.</b><p>{isMaster ? 'Crea una sala per questa giornata e aggiungi i tavoli.' : 'Non ci sono sale o tavoli programmati per questa data.'}</p>{isMaster && <button type="button" className="button-primary" onClick={onCreateRoom}><Plus size={16} /> Crea sala per questa data</button>}</div>
      )}
      <div className="table-room-footer"><span>✦</span> Ogni grande storia comincia con un posto libero. <span>✦</span></div>
    </div>
  )
}
