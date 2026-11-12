import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Crown, Moon, Sun } from 'lucide-react'
import type { Group, PollVote, SessionPoll, User } from '../types'

interface CalendarHeatmapProps {
  group: Group
  poll: SessionPoll
  users: User[]
  isMaster: boolean
  currentUserId: string
  onVote: (date: string) => void
}

const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayHeatClass(votes: PollVote[], date: string, group: Group) {
  const dayVotes = votes.filter((vote) => vote.date === date && vote.available)
  const expected = group.memberIds.length + 1
  const masterAvailable = dayVotes.some((vote) => vote.userId === group.masterId)
  if (!masterAvailable) return 'heat-critical'
  const percentage = dayVotes.length / expected
  if (percentage === 1) return 'heat-full'
  if (percentage >= 0.75) return 'heat-high'
  if (percentage >= 0.5) return 'heat-mid'
  return 'heat-low'
}

export function CalendarHeatmap({ group, poll, users, isMaster, currentUserId, onVote }: CalendarHeatmapProps) {
  const firstDate = new Date(`${poll.availableDates[0]}T12:00:00`)
  const [monthOffset, setMonthOffset] = useState(0)
  const displayMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + monthOffset, 1)
  const monthLabel = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(displayMonth)
  const firstWeekday = (displayMonth.getDay() + 6) % 7
  const daysInMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate()
  const calendarDays: (number | null)[] = Array.from({ length: firstWeekday }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) calendarDays.push(day)
  while (calendarDays.length % 7 !== 0) calendarDays.push(null)
  const pollDates = new Set(poll.availableDates)

  function dayVoters(date: string) {
    return poll.votes.filter((vote) => vote.date === date && vote.available).map((vote) => users.find((user) => user.id === vote.userId)).filter((user): user is User => Boolean(user))
  }

  return (
    <div className="calendar-card">
      <div className="calendar-top">
        <div className="calendar-month">
          <span className="month-icon"><CalendarDays size={16} /></span>
          <div><strong>{monthLabel}</strong><small>{poll.availableDates.length} date in votazione</small></div>
        </div>
        <div className="calendar-arrows">
          <button type="button" aria-label="Mese precedente" onClick={() => setMonthOffset((offset) => offset - 1)}><ChevronLeft size={17} /></button>
          <button type="button" aria-label="Mese successivo" onClick={() => setMonthOffset((offset) => offset + 1)}><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="calendar-grid">
        {weekdays.map((day) => <span className="weekday" key={day}>{day}</span>)}
        {calendarDays.map((day, index) => {
          if (!day) return <span className="calendar-blank" key={`blank-${index}`} />
          const date = dateKey(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day))
          const isPollDate = pollDates.has(date)
          const voters = isPollDate ? dayVoters(date) : []
          const myVote = poll.votes.find((vote) => vote.userId === currentUserId && vote.date === date)
          const confirmed = poll.confirmedDate === date
          const heat = isPollDate ? dayHeatClass(poll.votes, date, group) : ''
          const count = voters.length
          const label = isPollDate ? `${count} di ${group.memberIds.length + 1} disponibili${confirmed ? ', sessione confermata' : ''}` : date
          return (
            <button
              type="button"
              key={date}
              className={`calendar-day ${isPollDate ? 'poll-day' : 'inactive-day'} ${heat} ${myVote?.available ? 'my-vote' : ''} ${myVote && !myVote.available ? 'my-no-vote' : ''} ${confirmed ? 'confirmed-day' : ''}`}
              disabled={!isPollDate || poll.status !== 'active'}
              onClick={() => onVote(date)}
              title={label}
              aria-label={`${day} ${monthLabel}: ${label}`}
            >
              <span className="day-number">{day}</span>
              {isPollDate && <span className="day-votes">{count}<small>/{group.memberIds.length + 1}</small></span>}
              {confirmed && <Crown className="confirmed-crown" size={12} />}
              {isPollDate && !confirmed && <span className="day-status">{myVote?.available ? <Sun size={11} /> : <Moon size={10} />}</span>}
              {isPollDate && <span className="day-tooltip">{label}</span>}
            </button>
          )
        })}
      </div>
      <div className="calendar-legend">
        <span><i className="legend-dot heat-full" />Tutti</span>
        <span><i className="legend-dot heat-high" />Quasi</span>
        <span><i className="legend-dot heat-mid" />Parziale</span>
        <span><i className="legend-dot heat-critical" />Critico</span>
      </div>
      {poll.status === 'active' && <div className="vote-hint"><Sun size={13} /> {isMaster ? 'Segna la disponibilità del Master per completare la heatmap' : 'Tocca un giorno per indicare la tua disponibilità'}</div>}
    </div>
  )
}
