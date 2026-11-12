import { useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, Check, ChevronDown, Dices, ImagePlus, Plus, Sparkles, Users, X } from 'lucide-react'
import type { GameRoom, GameTable, GameTableInput, Group, User } from '../types'

interface ModalShellProps {
  title: string
  subtitle: string
  icon: ReactNode
  onClose: () => void
  children: ReactNode
}

function ModalShell({ title, subtitle, icon, onClose, children }: ModalShellProps) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header"><div className="modal-icon">{icon}</div><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Chiudi"><X size={18} /></button></header>
        {children}
      </section>
    </div>
  )
}

interface CreateGroupModalProps {
  group?: Group
  onClose: () => void
  onSave: (data: { name: string; description: string }) => Promise<void>
}

export function CreateGroupModal({ group, onClose, onSave }: CreateGroupModalProps) {
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    void onSave({ name: name.trim(), description: description.trim() })
      .then(onClose)
      .catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Salvataggio del gruppo non riuscito.'))
      .finally(() => setBusy(false))
  }
  return (
    <ModalShell title={group ? 'Modifica gruppo' : 'Crea un gruppo'} subtitle={group ? 'Aggiorna nome e descrizione del gruppo.' : 'Un nuovo party, una nuova storia.'} icon={<Users size={19} />} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>Nome del gruppo<input autoFocus required maxLength={70} value={name} onChange={(event) => setName(event.target.value)} placeholder="Es. La Compagnia dell’Alba" /></label>
        <label>Descrizione <span className="optional-label">OPZIONALE</span><textarea rows={2} maxLength={180} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Di cosa parla la vostra prossima avventura?" /></label>
        {!group && <div className="modal-footnote"><Sparkles size={14} /> Dopo la creazione riceverai un codice invito da condividere con il party.</div>}
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={busy}>{group ? <Check size={15} /> : <Plus size={15} />} {group ? 'Salva gruppo' : 'Crea gruppo'}</button></div>
      </form>
    </ModalShell>
  )
}

  export function CreateRoomModal({ room, date, onClose, onSave }: { room?: GameRoom; date: string; onClose: () => void; onSave: (values: { name: string; description: string; eventDate: string }) => Promise<void> }) {
    const [name, setName] = useState(room?.name ?? '')
    const [description, setDescription] = useState(room?.description ?? '')
    const [eventDate, setEventDate] = useState(room?.eventDate ?? date)
    const [formError, setFormError] = useState('')
    const [busy, setBusy] = useState(false)
    return (
      <ModalShell title="Crea una sala" subtitle="Organizza tavoli per D&D, Magic o un’altra attività." icon={<Dices size={19} />} onClose={onClose}>
        <form className="modal-form" onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setFormError('')
          void onSave({ name: name.trim(), description: description.trim(), eventDate }).then(onClose).catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Salvataggio della sala non riuscito.')).finally(() => setBusy(false))
        }}>
          <label>Data dell’evento<input required type="date" value={eventDate} disabled={Boolean(room)} onChange={(event) => setEventDate(event.target.value)} /></label>
          <label>Nome della sala<input autoFocus required maxLength={70} value={name} onChange={(event) => setName(event.target.value)} placeholder="Es. Sala D&D" /></label>
          <label>Descrizione <span className="optional-label">OPZIONALE</span><textarea rows={2} maxLength={180} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrivi le attività di questa sala." /></label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={busy}>{room ? <Check size={15} /> : <Plus size={15} />} {room ? 'Salva sala' : 'Crea sala'}</button></div>
        </form>
      </ModalShell>
    )
  }

  export function CreateWorkspaceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<void> }) {
    const [name, setName] = useState('')
    const [formError, setFormError] = useState('')
    const [busy, setBusy] = useState(false)
    return (
      <ModalShell title="Crea uno spazio" subtitle="Un nuovo negozio o una nuova community, collegata al tuo account." icon={<Sparkles size={19} />} onClose={onClose}>
        <form className="modal-form" onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setFormError('')
          void onCreate(name.trim()).then(onClose).catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Creazione dello spazio non riuscita.')).finally(() => setBusy(false))
        }}>
          <label>Nome dello spazio<input autoFocus required maxLength={70} value={name} onChange={(event) => setName(event.target.value)} placeholder="Es. La Taverna del Drago" /></label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={busy}><Plus size={15} /> Crea spazio</button></div>
        </form>
      </ModalShell>
    )
  }

  export function ProfileModal({ user, email, onClose, onSave, onUpload, onChangePassword, onSignOut }: {
    user: User
    email: string
    onClose: () => void
    onSave: (name: string, avatarUrl: string) => Promise<void>
    onUpload: (file: File) => Promise<string>
    onChangePassword: (password: string) => Promise<void>
    onSignOut: () => void
  }) {
    const [name, setName] = useState(user.name)
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl)
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState(false)
    const [formError, setFormError] = useState('')
    async function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setBusy(true)
      setFormError('')
      try {
        await onSave(name, avatarUrl)
        if (password) await onChangePassword(password)
        onClose()
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Non è stato possibile aggiornare il profilo.')
      } finally {
        setBusy(false)
      }
    }
    return (
      <ModalShell title="Il tuo profilo" subtitle="Gestisci il nome e le informazioni del tuo account." icon={<Users size={19} />} onClose={onClose}>
        <form className="modal-form" onSubmit={(event) => void submit(event)}>
          <label>Nickname<input autoFocus required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Email<input value={email} readOnly /></label>
          <label>Immagine profilo (URL)<input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." /></label>
          <label>Oppure carica un’immagine<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            setBusy(true)
            void onUpload(file).then(setAvatarUrl).catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Caricamento non riuscito.')).finally(() => setBusy(false))
          }} /></label>
          <label>Nuova password <span className="optional-label">LASCIA VUOTO PER NON MODIFICARE</span><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={busy}><Check size={15} /> Salva profilo</button></div>
          <button type="button" className="auth-signout" onClick={onSignOut}>Esci dall’account</button>
        </form>
      </ModalShell>
    )
  }

interface JoinGroupModalProps {
  onClose: () => void
  onJoin: (code: string) => void | Promise<void>
}

export function JoinGroupModal({ onClose, onJoin }: JoinGroupModalProps) {
  const [code, setCode] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onJoin(code.trim())
  }

  return (
    <ModalShell title="Unisciti a un gruppo" subtitle="Inserisci il codice ricevuto dal Master." icon={<Users size={19} />} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>Codice invito<input autoFocus required autoCapitalize="characters" minLength={20} maxLength={80} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Incolla qui il codice" /></label>
        <div className="modal-footnote"><Sparkles size={14} /> L’invito è personale, scade dopo 30 giorni e non rivela i dati degli altri gruppi.</div>
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary"><Users size={15} /> Entra nel gruppo</button></div>
      </form>
    </ModalShell>
  )
}

interface CreatePollModalProps {
  groups: Group[]
  initialGroupId?: string
  onClose: () => void
  onCreate: (data: { groupId: string; title: string; startDate: string; endDate: string }) => void
}

export function CreatePollModal({ groups, initialGroupId, onClose, onCreate }: CreatePollModalProps) {
  const [groupId, setGroupId] = useState(initialGroupId ?? groups[0]?.id ?? '')
  const [title, setTitle] = useState('La prossima sessione')
  const [startDate, setStartDate] = useState(initialPollStartInput)
  const [endDate, setEndDate] = useState(initialPollEndInput)
  const invalidRange = endDate < startDate

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!invalidRange) onCreate({ groupId, title: title.trim(), startDate, endDate })
  }

  return (
    <ModalShell title="Apri un sondaggio" subtitle="Metti le date sul tavolo e lascia scegliere il party." icon={<CalendarDays size={19} />} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>Gruppo<select required value={groupId} onChange={(event) => setGroupId(event.target.value)}>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select><ChevronDown className="select-chevron" size={15} /></label>
        <label>Titolo del sondaggio<input required maxLength={70} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Es. Serata a Barovia" /></label>
        <div className="date-fields"><label>Dal<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Al<input type="date" required min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>
        {invalidRange && <span className="form-error">La data finale non può precedere quella iniziale.</span>}
        <div className="modal-footnote"><Users size={14} /> Tutti i membri del gruppo potranno votare ogni giorno.</div>
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={invalidRange}><CalendarDays size={15} /> Apri sondaggio</button></div>
      </form>
    </ModalShell>
  )
}

interface CreateTableModalProps {
  table: GameTable | null
  rooms: GameRoom[]
  users: User[]
  currentRoomId: string
  isOwner: boolean
  onClose: () => void
  onSave: (values: GameTableInput) => void
  onUpload: (file: File) => Promise<string>
}

const coverPresets = [
  { name: 'Foresta', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=85' },
  { name: 'Taverna', url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=85' },
  { name: 'Nebbia', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85' },
]
const systems = ['D&D 5e · 2014', 'D&D 5e · 2024', 'Pathfinder 2e', 'Call of Cthulhu', 'Altro']
const initialPollStart = new Date()
initialPollStart.setDate(initialPollStart.getDate() + 1)
const initialPollEnd = new Date(initialPollStart)
initialPollEnd.setDate(initialPollEnd.getDate() + 6)
const initialPollStartInput = `${initialPollStart.getFullYear()}-${String(initialPollStart.getMonth() + 1).padStart(2, '0')}-${String(initialPollStart.getDate()).padStart(2, '0')}`
const initialPollEndInput = `${initialPollEnd.getFullYear()}-${String(initialPollEnd.getMonth() + 1).padStart(2, '0')}-${String(initialPollEnd.getDate()).padStart(2, '0')}`

export function CreateTableModal({ table, rooms, users, currentRoomId, isOwner, onClose, onSave, onUpload }: CreateTableModalProps) {
  const [name, setName] = useState(table?.name ?? '')
  const [adventureTitle, setAdventureTitle] = useState(table?.adventureTitle ?? '')
  const [system, setSystem] = useState(table?.system ?? systems[1] ?? '')
  const [customSystem, setCustomSystem] = useState(table && !systems.includes(table.system) ? table.system : '')
  const [imageUrl, setImageUrl] = useState(table?.imageUrl ?? coverPresets[0]?.url ?? '')
  const [maxSeats, setMaxSeats] = useState(table?.maxSeats ?? 5)
  const [notes, setNotes] = useState(table?.notes ?? '')
  const [customCover, setCustomCover] = useState(false)
  const [roomId, setRoomId] = useState(table?.roomId ?? currentRoomId)
  const [masterUserId, setMasterUserId] = useState(table?.masterUserId ?? '')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const minimumSeats = Math.max(2, ...(table?.seats.map((seat) => seat.seatNumber) ?? []))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave({ roomId, masterUserId: isOwner ? masterUserId || null : table?.masterUserId ?? null, name: name.trim(), adventureTitle: adventureTitle.trim(), system: system === 'Altro' ? customSystem.trim() : system, imageUrl: imageUrl.trim(), maxSeats, notes: notes.trim() })
  }

  return (
    <ModalShell title={table ? 'Modifica tavolo' : 'Crea un tavolo'} subtitle="Prepara il tavolo e raduna la compagnia." icon={<Dices size={19} />} onClose={onClose}>
      <form className="modal-form table-modal-form" onSubmit={submit}>
        {rooms.length > 1 && <label>Sala<select required value={roomId} onChange={(event) => setRoomId(event.target.value)}>{rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>}
        <label>Nome del tavolo<input autoFocus required maxLength={70} value={name} onChange={(event) => setName(event.target.value)} placeholder="Es. Tavolo 1 · La Taverna del Drago" /></label>
        <label>Titolo dell’avventura<input required maxLength={70} value={adventureTitle} onChange={(event) => setAdventureTitle(event.target.value)} placeholder="Es. Il Risveglio del Lich" /></label>
        <div className="date-fields"><label>Sistema di gioco<select value={systems.includes(system) ? system : 'Altro'} onChange={(event) => setSystem(event.target.value)}>{systems.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown className="select-chevron" size={15} /></label><label>Posti disponibili<select value={maxSeats} onChange={(event) => setMaxSeats(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => index + 2).filter((seats) => seats >= minimumSeats).map((seats) => <option value={seats} key={seats}>{seats} posti</option>)}</select><ChevronDown className="select-chevron" size={15} />{minimumSeats > 2 && <small className="seat-minimum-note">Minimo {minimumSeats} per conservare i posti prenotati</small>}</label></div>
        {system === 'Altro' && <label>Nome del sistema<input required value={customSystem} onChange={(event) => setCustomSystem(event.target.value)} placeholder="Es. Fabula Ultima" /></label>}
        <label>Immagine di copertina <button type="button" className="inline-edit" onClick={() => setCustomCover(!customCover)}><ImagePlus size={13} /> {customCover ? 'Scegli una copertina' : 'Usa un URL'}</button></label>
        {customCover ? <input aria-label="URL copertina" type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." /> : (
          <div className="cover-presets">{coverPresets.map((cover) => <button type="button" className={`cover-preset ${imageUrl === cover.url ? 'preset-active' : ''}`} key={cover.name} onClick={() => setImageUrl(cover.url)}><img src={cover.url} alt="" /><span>{cover.name}</span>{imageUrl === cover.url && <Check size={14} />}</button>)}</div>
        )}
        <label>Carica copertina dal dispositivo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          setBusy(true)
          setFormError('')
          void onUpload(file).then(setImageUrl).catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Caricamento non riuscito.')).finally(() => setBusy(false))
        }} /></label>
        {isOwner && <label>Master del tavolo<select value={masterUserId} onChange={(event) => setMasterUserId(event.target.value)}><option value="">Nessuno (gestisce il proprietario)</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>}
        <label>Note e informazioni <span className="optional-label">OPZIONALE</span><textarea rows={2} maxLength={160} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Livello, durata, requisiti, benvenuto ai nuovi giocatori..." /></label>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Annulla</button><button type="submit" className="button-primary" disabled={busy}><Dices size={15} /> {table ? 'Salva modifiche' : 'Crea tavolo'}</button></div>
      </form>
    </ModalShell>
  )
}
