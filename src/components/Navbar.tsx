import { useState } from 'react'
import { CalendarDays, ChevronDown, Dices, Plus, ScrollText, Settings2, Share2, Sparkles, Table2, Users } from 'lucide-react'
import { useApp } from '../store/useApp'

interface NavbarProps {
  onCreateGroup: () => void
  onCreateWorkspace: () => void
  onCreateInvite: (groupId: string) => void
  onJoinGroup: () => void
  onProfile: () => void
}

export function Navbar({ onCreateGroup, onCreateWorkspace, onCreateInvite, onJoinGroup, onProfile }: NavbarProps) {
  const { state, setView, setSelectedGroup, selectWorkspace, currentUser, isMaster } = useApp()
  const [groupsOpen, setGroupsOpen] = useState(true)
  const groups = isMaster ? state.groups : state.groups.filter((group) => group.memberIds.includes(currentUser.id))

  return (
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
        <span className="brand-mark"><Dices size={21} strokeWidth={2.2} /></span>
        <span><b>GUILDHALL</b><small>La tua casa, fuori dal gioco</small></span>
      </a>
      <div className="workspace-selector">
        <span className="workspace-emblem">✦</span>
        <label className="workspace-text"><small>SPAZIO DI GIOCO</small><select aria-label="Cambia spazio" className="workspace-select" value={state.selectedWorkspaceId} onChange={(event) => void selectWorkspace(event.target.value)}>{state.workspaces.map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}</select></label>
        <button type="button" className="workspace-add" onClick={onCreateWorkspace} title="Crea un altro spazio" aria-label="Crea un altro spazio"><Plus size={15} /></button>
      </div>

      <div className="side-label">IL TUO SPAZIO</div>
      <nav className="main-nav" aria-label="Navigazione principale">
        <button type="button" className={state.activeView === 'calendar' ? 'nav-item active' : 'nav-item'} onClick={() => setView('calendar')}>
          <CalendarDays size={17} /><span>Calendario</span>          <span className="nav-count">{state.polls.filter((poll) => poll.status === 'active').length}</span>
        </button>
        <button type="button" className={state.activeView === 'tables' ? 'nav-item active' : 'nav-item'} onClick={() => setView('tables')}>
          <Table2 size={17} /><span>Sala Tavoli</span><span className="nav-count muted">{state.tables.length}</span>
        </button>
        <button type="button" className="nav-item invite-nav-item" onClick={onJoinGroup}><Share2 size={16} /><span>Invito</span></button>
        <button type="button" className="nav-item" onClick={() => setView('calendar')}><ScrollText size={17} /><span>Le mie avventure</span></button>
      </nav>

      <div className="group-nav-heading">
        <button type="button" className="group-toggle" onClick={() => setGroupsOpen(!groupsOpen)}><ChevronDown size={13} className={groupsOpen ? '' : 'chevron-closed'} /> I TUOI GRUPPI</button>
        {isMaster && <button type="button" className="icon-button subtle" onClick={onCreateGroup} title="Crea gruppo" aria-label="Crea gruppo"><Plus size={16} /></button>}
      </div>
      {groupsOpen && (
        <div className="group-list">
          {isMaster && (
            <button type="button" className={`group-option ${state.selectedGroupId === 'all' ? 'selected' : ''}`} onClick={() => setSelectedGroup('all')}>
              <span className="group-mark all"><Sparkles size={13} /></span><span>Tutti i gruppi</span><span className="master-tag">MASTER</span>
            </button>
          )}
          {groups.map((group, index) => (
            <div className={`group-option-wrap ${state.selectedGroupId === group.id ? 'selected' : ''}`} key={group.id}>
              <button type="button" className="group-option" onClick={() => setSelectedGroup(group.id)}>
                <span className={`group-mark group-color-${index % 4}`}><Dices size={13} /></span><span className="group-name">{group.name}</span>
              </button>
              {isMaster && <button type="button" className="group-invite-button" onClick={() => onCreateInvite(group.id)} title={`Crea invito per ${group.name}`} aria-label={`Crea invito per ${group.name}`}><Share2 size={13} /></button>}
            </div>
          ))}
          {isMaster && <button type="button" className="add-group-link" onClick={onCreateGroup}><Plus size={14} /> Crea un gruppo</button>}
          <button type="button" className="add-group-link" onClick={onJoinGroup}><Plus size={14} /> Unisciti con codice</button>
          <button type="button" className="add-group-link" onClick={onCreateWorkspace}><Plus size={14} /> Crea un altro spazio</button>
        </div>
      )}

      <div className="sidebar-bottom">
        <div className="sidebar-tip">
          <div className="tip-glow"><Sparkles size={15} /></div>
          <b>La prossima avventura?</b>
          <span>Comincia da una data che va bene a tutti.</span>
          <button type="button" onClick={() => setView('calendar')}>Apri calendario <span>↗</span></button>
        </div>
        <button type="button" className="profile-button" onClick={onProfile}>
          <span className="profile-avatar" style={{ backgroundColor: currentUser.color }}>{currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : currentUser.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          <span className="profile-name"><b>{currentUser.name}</b><small>{isMaster ? 'Dungeon Master' : 'Avventuriero'}</small></span>
          <Settings2 size={16} />
        </button>
        <div className="sidebar-footer"><Users size={12} /> Una gilda, infinite storie</div>
      </div>
    </aside>
  )
}
