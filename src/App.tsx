import { useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, CircleHelp, Dices, LogOut, Plus, Share2, Shield, Sparkles, Users } from 'lucide-react'
import { AuthGate } from './components/AuthGate'
import { BestDaysList } from './components/BestDaysList'
import { CalendarHeatmap } from './components/CalendarHeatmap'
import { CreateGroupModal, CreatePollModal, CreateTableModal, JoinGroupModal } from './components/Modals'
import { Navbar } from './components/Navbar'
import { TablesRoom } from './components/TablesRoom'
import { AppProvider } from './store/AppContext'
import { useApp } from './store/useApp'
import './App.css'
import type { GameTable, Group } from './types'

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function GroupSchedule({ group }: { group: Group }) {
  const { state, isMaster, currentUser, toggleVote, confirmSession } = useApp()
  const groupPolls = state.polls.filter((item) => item.groupId === group.id)
  const poll = groupPolls.find((item) => item.status === 'active')
    ?? [...groupPolls].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const playerCount = group.memberIds.length + 1
  const responseCount = poll ? new Set(poll.votes.map((vote) => vote.userId)).size : 0

  return (
    <section className="schedule-section">
      <div className="schedule-heading">
        <div className="schedule-group-icon"><Dices size={17} /></div>
        <div className="schedule-group-copy">
          <div className="eyebrow">{group.name}</div>
          <h2>{poll?.title ?? 'Nessun sondaggio attivo'}</h2>
        </div>
        {poll && (
          <div className="poll-summary">
            <span className={`status-dot ${poll.status === 'active' ? 'is-live' : 'is-confirmed'}`} />
            {poll.status === 'active' ? 'Sondaggio aperto' : poll.status === 'confirmed' ? 'Sessione confermata' : 'Sondaggio archiviato'}
          </div>
        )}
      </div>
      {poll ? (
        <div className="calendar-layout">
          <CalendarHeatmap
            group={group}
            poll={poll}
            users={state.users}
            isMaster={isMaster}
            currentUserId={currentUser.id}
            onVote={(date) => toggleVote(group.id, date)}
          />
          <BestDaysList
            group={group}
            poll={poll}
            users={state.users}
            isMaster={isMaster}
            onConfirm={(date) => confirmSession(poll.id, date)}
          />
        </div>
      ) : (
        <div className="empty-poll">
          <CalendarDays size={24} />
          <strong>Il calendario è pronto</strong>
          <span>{isMaster ? 'Avvia un sondaggio per trovare il giorno perfetto.' : 'Il Master non ha ancora aperto un sondaggio.'}</span>
        </div>
      )}
      <div className="schedule-footer">
        <div className="response-avatars" aria-label={`${responseCount} risposte`}>
          {state.users.filter((user) => poll?.votes.some((vote) => vote.userId === user.id)).slice(0, 4).map((user) => (
            <span className="mini-avatar" key={user.id} title={user.name} style={{ backgroundColor: user.color }}>{initials(user.name)}</span>
          ))}
          <span className="response-copy"><b>{responseCount}/{playerCount}</b> giocatori hanno risposto</span>
        </div>
        <span className="schedule-updated"><Sparkles size={13} /> Aggiornato ora</span>
      </div>
    </section>
  )
}

function Dashboard() {
  const { state, currentUser, isMaster, setView, setSelectedGroup, createTable, updateTable, deleteTable, createGroup, createPoll, createInvite, joinGroup, inviteCode, clearInvite, signOut, error, clearError } = useApp()
  const [modal, setModal] = useState<'group' | 'poll' | 'table' | 'join' | null>(null)
  const [editingTable, setEditingTable] = useState<GameTable | null>(null)
  const [copyError, setCopyError] = useState('')
  const visibleGroups = useMemo(() => {
    if (isMaster) return state.groups
    return state.groups.filter((group) => group.memberIds.includes(currentUser.id))
  }, [currentUser.id, isMaster, state.groups])
  const isAllGroups = isMaster && state.selectedGroupId === 'all'
  const activeGroups = isAllGroups
    ? visibleGroups
    : visibleGroups.filter((group) => group.id === state.selectedGroupId)
  const activePoll = state.polls.find((poll) => poll.groupId === (activeGroups[0]?.id ?? state.selectedGroupId) && poll.status === 'active')
  const totalMembers = activeGroups.reduce((total, group) => total + group.memberIds.length + 1, 0)
  const isTables = state.activeView === 'tables'

  async function copyInvite() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopyError('')
      clearInvite()
    } catch (clipboardError) {
      console.error('Copia del codice invito non riuscita.', clipboardError)
      setCopyError('Copia automatica non disponibile: seleziona il codice e copialo manualmente.')
    }
  }

  function handleCreateTable(values: Omit<GameTable, 'id' | 'seats'>) {
    if (editingTable) updateTable(editingTable.id, values)
    else createTable(values)
    setEditingTable(null)
    setModal(null)
  }

  return (
    <div className="app-shell">
      <Navbar onCreateGroup={() => setModal('group')} onCreateInvite={(groupId) => void createInvite(groupId)} onJoinGroup={() => setModal('join')} />
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>La tua gilda</span><ChevronRight size={14} /><b>{isTables ? 'Sala Tavoli' : 'Calendario'}</b>
          </div>
          <div className="topbar-right">
            <span className="online-indicator"><i /> Dati sincronizzati</span>
            <div className="role-label"><Shield size={14} /> {isMaster ? 'Master' : 'Avventuriero'}</div>
            <button type="button" className="help-button" aria-label="Aiuto" title="Aiuto"><CircleHelp size={17} /></button>
            <span className="top-avatar" style={{ backgroundColor: currentUser.color }} title={currentUser.name}>{initials(currentUser.name)}</span>
            <button type="button" className="signout-button" onClick={() => void signOut()} title="Esci" aria-label="Esci"><LogOut size={15} /></button>
          </div>
        </header>

        <main className="page-content">
          {error && <div className="app-alert" role="alert"><span>{error}</span><button type="button" onClick={clearError} aria-label="Chiudi">×</button></div>}
          {inviteCode && <div className="invite-banner"><div><b>Codice invito creato</b><span>{copyError || 'Condividilo solo con chi vuoi far entrare nel gruppo.'}</span></div><code>{inviteCode}</code><button type="button" className="button-secondary" onClick={() => void copyInvite()}>Copia codice</button><button type="button" className="banner-close" onClick={clearInvite} aria-label="Chiudi">×</button></div>}
          {!isTables ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="page-kicker"><span className="kicker-line" /> IL PROSSIMO INCONTRO INIZIA QUI</div>
                  <h1>Troviamo il momento <span>giusto.</span></h1>
                  <p>Incrocia le disponibilità del party e trasforma una data in una nuova avventura.</p>
                </div>
                {isMaster && (
                  <button type="button" className="button-primary" onClick={() => setModal('poll')}>
                    <Plus size={17} /> Nuovo sondaggio
                  </button>
                )}
              </div>

              <div className="overview-row">
                <div className="overview-card overview-card-featured">
                  <div className="overview-icon purple"><CalendarDays size={18} /></div>
                  <div><span className="overview-label">Sondaggi aperti</span><strong>{state.polls.filter((poll) => poll.status === 'active' && visibleGroups.some((group) => group.id === poll.groupId)).length.toString().padStart(2, '0')}</strong></div>
                  <span className="overview-decoration"><CalendarDays size={58} /></span>
                </div>
                <div className="overview-card">
                  <div className="overview-icon amber"><Users size={18} /></div>
                  <div><span className="overview-label">Nel party</span><strong>{totalMembers || 0}<small> membri</small></strong></div>
                  <span className="overview-note"><span className="tiny-spark">✦</span> {visibleGroups.length} gruppi</span>
                </div>
                <div className="overview-card next-date-card">
                  <div className="overview-icon green"><Sparkles size={17} /></div>
                  <div><span className="overview-label">Prossima data scelta</span><strong>{activeGroups.find((group) => state.polls.some((poll) => poll.groupId === group.id && poll.status === 'confirmed')) ? 'Pronti a partire' : 'Da definire'}</strong></div>
                  <span className="overview-note">{activePoll ? `${activePoll.availableDates.length} date in votazione` : 'Apri un sondaggio'}</span>
                </div>
              </div>

              <div className="section-title-row">
                <div>
                  <h2>Disponibilità del gruppo</h2>
                  <p>Una sola data, una compagnia perfetta.</p>
                </div>
                <button type="button" className="text-button" onClick={() => setView('tables')}>Vai alla Sala Tavoli <ChevronRight size={15} /></button>
              </div>

              {activeGroups.length ? (
                <div className={isAllGroups ? 'all-schedules' : ''}>
                  {activeGroups.map((group) => <GroupSchedule key={group.id} group={group} />)}
                </div>
              ) : (
                <div className="empty-poll"><Users size={24} /><strong>{isMaster ? 'La gilda è pronta per la prima campagna.' : 'Non fai ancora parte di un gruppo.'}</strong><span>{isMaster ? 'Crea un gruppo e invita il tuo party con un codice sicuro.' : 'Chiedi al Master il codice invito del gruppo.'}</span>{isMaster ? <button type="button" className="button-primary" onClick={() => setModal('group')}><Plus size={15} /> Crea gruppo</button> : <button type="button" className="button-primary" onClick={() => setModal('join')}><Share2 size={15} /> Inserisci codice invito</button>}</div>
              )}
            </>
          ) : (
            <TablesRoom
              tables={state.tables}
              users={state.users}
              currentUser={currentUser}
              isMaster={isMaster}
              onCreate={() => { setEditingTable(null); setModal('table') }}
              onEdit={(table) => { setEditingTable(table); setModal('table') }}
              onDelete={deleteTable}
            />
          )}
        </main>
      </div>

      {modal === 'group' && <CreateGroupModal onClose={() => setModal(null)} onCreate={async (data) => { await createGroup(data); setModal(null) }} />}
      {modal === 'join' && <JoinGroupModal onClose={() => setModal(null)} onJoin={async (code) => { await joinGroup(code); setModal(null) }} />}
      {modal === 'poll' && <CreatePollModal groups={visibleGroups} initialGroupId={state.selectedGroupId === 'all' ? visibleGroups[0]?.id : state.selectedGroupId} onClose={() => setModal(null)} onCreate={(data) => { createPoll(data); setSelectedGroup(data.groupId); setModal(null) }} />}
      {modal === 'table' && <CreateTableModal table={editingTable} onClose={() => { setModal(null); setEditingTable(null) }} onSave={handleCreateTable} />}
    </div>
  )
}

function App() {
  return <AppProvider><AppContent /></AppProvider>
}

function AppContent() {
  const { authStatus, error, clearError } = useApp()
  if (authStatus === 'loadError') return <main className="auth-screen"><section className="auth-card"><div className="auth-card-heading"><span className="auth-icon"><Shield size={18} /></span><div><h1>Impossibile caricare lo spazio.</h1><p>{error ?? 'Controlla la configurazione e la migrazione Supabase, poi riprova.'}</p></div></div><div className="modal-actions"><button type="button" className="button-secondary" onClick={clearError}>Chiudi avviso</button><button type="button" className="button-primary" onClick={() => window.location.reload()}>Riprova</button></div></section></main>
  return authStatus === 'ready' ? <Dashboard /> : <AuthGate />
}

export default App
