import { useState, type FormEvent } from 'react'
import { ArrowRight, Dices, KeyRound, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import { useApp } from '../store/useApp'

export function AuthGate() {
  const { authStatus, error, clearError, signIn, signUp, createWorkspace, joinGroup, signOut, currentUser } = useApp()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    setFormError('')
    clearError()
    try {
      if (mode === 'login') await signIn(email, password)
      else {
        const signedIn = await signUp(name, email, password)
        if (!signedIn) setNotice('Account creato. Controlla la tua email e conferma l’indirizzo per continuare.')
      }
    } catch (authError) {
      console.error('Autenticazione non riuscita.', authError)
      setFormError(authError instanceof Error ? authError.message : 'Accesso non riuscito. Riprova.')
    } finally {
      setBusy(false)
    }
  }

  async function submitSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    clearError()
    setFormError('')
    try {
      if (workspaceName.trim()) await createWorkspace(workspaceName)
      else await joinGroup(inviteCode)
    } catch (setupError) {
      console.error('Configurazione dello spazio non riuscita.', setupError)
      setFormError(setupError instanceof Error ? setupError.message : 'Operazione non riuscita. Riprova.')
    } finally {
      setBusy(false)
    }
  }

  if (authStatus === 'loading') {
    return <main className="auth-screen"><div className="auth-loading"><span className="brand-mark"><Dices size={21} /></span><span>Prepariamo la tua gilda…</span></div></main>
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="auth-screen">
        <section className="auth-card config-card">
          <Brand />
          <div className="auth-card-heading"><span className="auth-icon"><KeyRound size={18} /></span><div><h1>Collega il tuo progetto</h1><p>La modalità demo è stata rimossa. Configura Supabase per attivare account e dati reali.</p></div></div>
          <ol className="setup-steps">
            <li><span>1</span><div><b>Crea un progetto Supabase</b><small>Dal dashboard Supabase, crea un progetto e apri Project Settings → API.</small></div></li>
            <li><span>2</span><div><b>Configura le variabili locali</b><small>Copia <code>.env.example</code> in <code>.env.local</code> e inserisci URL e chiave anon/publishable.</small></div></li>
            <li><span>3</span><div><b>Applica il database</b><small>Esegui in ordine le migrazioni <code>202611120001_initial_schema.sql</code> e <code>202611120002_workspaces_rooms_table_masters.sql</code> dal SQL Editor Supabase.</small></div></li>
          </ol>
          <p className="setup-security"><ShieldCheck size={15} /> La chiave client pubblica è protetta da policy RLS. Non inserire mai una service-role key nel frontend.</p>
        </section>
      </main>
    )
  }

  if (authStatus === 'needsWorkspace') {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <Brand />
          <div className="auth-card-heading"><span className="auth-icon"><Sparkles size={18} /></span><div><h1>La tua prossima avventura</h1><p>Crea uno spazio come Master oppure entra in un gruppo con un invito.</p></div></div>
          <form className="auth-form" onSubmit={submitSetup}>
            <label>Nome dello spazio di gioco<input autoFocus maxLength={70} value={workspaceName} onChange={(event) => { setWorkspaceName(event.target.value); setInviteCode('') }} placeholder="Es. La Compagnia Errante" /></label>
            <div className="auth-or"><span />OPPURE<span /></div>
            <label>Codice invito del Master<input autoCapitalize="characters" value={inviteCode} onChange={(event) => { setInviteCode(event.target.value.toUpperCase()); setWorkspaceName('') }} placeholder="Incolla il codice ricevuto" /></label>
            {(error || formError) && <p className="auth-error" role="alert">{error || formError}</p>}
            <button type="submit" className="button-primary auth-submit" disabled={busy || (!workspaceName.trim() && !inviteCode.trim())}>{busy ? 'Un momento…' : workspaceName.trim() ? 'Crea lo spazio' : 'Unisciti al gruppo'} <ArrowRight size={15} /></button>
          </form>
          <button type="button" className="auth-signout" onClick={() => { void signOut().catch((signOutError: unknown) => { console.error('Uscita non riuscita.', signOutError); setFormError(signOutError instanceof Error ? signOutError.message : 'Uscita non riuscita.') }) }}>Esci dall’account {currentUser.name ? `· ${currentUser.name}` : ''}</button>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <Brand />
        <div className="auth-card-heading"><span className="auth-icon"><Users size={18} /></span><div><h1>{mode === 'login' ? 'Bentornato in gilda.' : 'Entra nella gilda.'}</h1><p>{mode === 'login' ? 'Accedi per ritrovare il tuo party.' : 'Crea il tuo account e preparati a giocare.'}</p></div></div>
        <form className="auth-form" onSubmit={submitAuth}>
          {mode === 'register' && <label>Nickname<input autoComplete="nickname" autoFocus required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder="Come ti chiamano al tavolo?" /></label>}
          <label>Email<div className="auth-input-icon"><Mail size={14} /><input autoComplete="email" autoFocus={mode === 'login'} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@esempio.it" /></div></label>
          <label>Password<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Almeno 8 caratteri" /></label>
          {(error || formError) && <p className="auth-error" role="alert">{error || formError}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button type="submit" className="button-primary auth-submit" disabled={busy}>{busy ? 'Un momento…' : mode === 'login' ? 'Accedi' : 'Crea account'} <ArrowRight size={15} /></button>
        </form>
        <div className="auth-switch">{mode === 'login' ? 'Non hai ancora un account?' : 'Hai già un account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setNotice(''); setFormError(''); clearError() }}>{mode === 'login' ? 'Registrati' : 'Accedi'}</button></div>
        <p className="auth-privacy"><ShieldCheck size={13} /> Le password sono gestite in sicurezza da Supabase Auth.</p>
      </section>
    </main>
  )
}

function Brand() {
  return <a className="auth-brand" href="#" onClick={(event) => event.preventDefault()}><span className="brand-mark"><Dices size={21} /></span><span><b>GUILDHALL</b><small>La tua casa, fuori dal gioco</small></span></a>
}
