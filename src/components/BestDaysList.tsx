import { useMemo } from 'react'
import { ArrowUpRight, Check, Crown, Sparkles, Users } from 'lucide-react'
import type { Group, SessionPoll, User } from '../types'

interface BestDaysListProps {
  group: Group
  poll: SessionPoll
  users: User[]
  isMaster: boolean
  onConfirm: (date: string) => void
}

export function BestDaysList({ group, poll, users, isMaster, onConfirm }: BestDaysListProps) {
  const rankedDays = useMemo(() => poll.availableDates.map((date) => {
    const available = poll.votes.filter((vote) => vote.date === date && vote.available).map((vote) => users.find((user) => user.id === vote.userId)).filter((user): user is User => Boolean(user))
    const masterAvailable = available.some((user) => user.id === group.masterId)
    return { date, available, masterAvailable }
  }).sort((a, b) => b.available.length - a.available.length || Number(b.masterAvailable) - Number(a.masterAvailable) || a.date.localeCompare(b.date)), [group.masterId, poll.availableDates, poll.votes, users])

  return (
    <aside className="best-days-card">
      <div className="best-days-heading">
        <div><div className="best-days-title"><Sparkles size={15} /> GIORNI PROPIZI</div><h3>Le date più votate</h3></div>
        <span className="ranked-count">{rankedDays.length}</span>
      </div>
      <p className="best-days-subtitle">La compagnia si sta mettendo d’accordo.</p>
      <div className="ranked-list">
        {rankedDays.map((item, index) => {
          const formatted = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${item.date}T12:00:00`))
          const confirmed = poll.confirmedDate === item.date
          const percentage = Math.round((item.available.length / (group.memberIds.length + 1)) * 100)
          return (
            <article className={`ranked-day ${index === 0 ? 'top-ranked' : ''} ${confirmed ? 'ranked-confirmed' : ''}`} key={item.date}>
              <span className={`rank-badge ${index === 0 ? 'rank-first' : ''}`}>{String(index + 1).padStart(2, '0')}</span>
              <div className="ranked-day-content">
                <div className="ranked-date-line">
                  <strong>{formatted}</strong>
                  <span className={`availability-number ${!item.masterAvailable ? 'text-critical' : ''}`}>{item.available.length}<small>/{group.memberIds.length + 1}</small></span>
                </div>
                <div className="ranked-meta">
                  <div className="voter-stack">
                    {item.available.slice(0, 2).map((user) => <span className="voter-name-chip" key={user.id} title={user.name}><i style={{ backgroundColor: user.color }} />{user.name}</span>)}
                    {!item.available.length && <span className="no-votes">Ancora nessun sì</span>}
                    {item.available.length > 2 && <span className="voter-overflow">+{item.available.length - 2}</span>}
                  </div>
                  <span className="availability-label">{percentage}% presenti</span>
                </div>
                <div className="rank-progress"><span className={!item.masterAvailable ? 'progress-critical' : ''} style={{ width: `${percentage}%` }} /></div>
                {confirmed ? (
                  <span className="confirmed-label"><Crown size={12} /> Sessione confermata</span>
                ) : isMaster && poll.status === 'active' && (
                  <button type="button" className="confirm-button" onClick={() => onConfirm(item.date)}><Check size={13} /> Conferma sessione <ArrowUpRight size={13} /></button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <div className="party-availability"><Users size={15} /><span><b>{group.memberIds.length + 1} avventurieri</b> nel gruppo</span><div className="availability-light"><i /><i /><i /><i /></div></div>
    </aside>
  )
}
