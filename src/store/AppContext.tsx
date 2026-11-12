import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js'
import type { AppState, AppView, AuthStatus, CreateGroupInput, CreatePollInput, GameTableInput, Group, PollStatus, Role, User } from '../types'
import { supabase } from '../lib/supabase'
import { AppContext } from './context'

const EMPTY_STATE: AppState = {
  workspaceName: '',
  users: [],
  groups: [],
  polls: [],
  tables: [],
  role: 'player',
  currentUserId: '',
  selectedGroupId: '',
  activeView: 'calendar',
}

const USER_COLORS = ['#d79865', '#a28dde', '#77b4a1', '#dc8f90', '#83a4df', '#c4a768', '#da8bc5']

function getSupabaseClient() {
  if (!supabase) throw new Error('Supabase non è configurato. Aggiungi VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY al file .env.local.')
  return supabase
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Si è verificato un errore imprevisto. Riprova.'
}

function mapStatus(status: string): PollStatus {
  return status === 'confirmed' || status === 'closed' ? status : 'active'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE)
  const [authStatus, setAuthStatus] = useState<AuthStatus>(supabase ? 'loading' : 'signedOut')
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  const loadWorkspace = useCallback(async (user: SupabaseUser) => {
    const client = getSupabaseClient()
    const membershipResult = await client.from('workspace_members')
      .select('workspace_id, role, workspaces(id, name, owner_id)')
      .eq('user_id', user.id)
      .maybeSingle()
    if (membershipResult.error) throw membershipResult.error
    const membership = membershipResult.data
    if (!membership) {
      setState({ ...EMPTY_STATE, currentUserId: user.id })
      setAuthStatus('needsWorkspace')
      return
    }

    const workspace = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces
    if (!workspace) throw new Error('Non è stato possibile caricare lo spazio di gioco associato al tuo account.')
    const masterId = workspace.owner_id as string
    const groupsResult = await client.from('game_groups')
      .select('id, name, description, created_by')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true })
    if (groupsResult.error) throw groupsResult.error
    const rawGroups = groupsResult.data ?? []
    const groupIds = rawGroups.map((group) => group.id as string)
    const membershipsResult = groupIds.length
      ? await client.from('group_members').select('group_id, user_id').in('group_id', groupIds)
      : { data: [], error: null }
    if (membershipsResult.error) throw membershipsResult.error
    const groupMembers = membershipsResult.data ?? []
    const userIds = [...new Set([masterId, user.id, ...groupMembers.map((member) => member.user_id as string)])]
    const profilesResult = await client.from('profiles').select('id, display_name, color').in('id', userIds)
    if (profilesResult.error) throw profilesResult.error
    const profiles = profilesResult.data ?? []
    const users: User[] = profiles.map((profile, index) => ({
      id: profile.id as string,
      name: (profile.display_name as string) || 'Avventuriero',
      role: profile.id === masterId ? 'master' : 'player',
      color: (profile.color as string) || USER_COLORS[index % USER_COLORS.length] || '#a28dde',
    }))
    if (!users.some((profile) => profile.id === user.id)) {
      users.push({
        id: user.id,
        name: (user.user_metadata.display_name as string) || user.email || 'Avventuriero',
        role: user.id === masterId ? 'master' : 'player',
        color: USER_COLORS[users.length % USER_COLORS.length] || '#a28dde',
      })
    }
    const groups: Group[] = rawGroups.map((group) => ({
      id: group.id as string,
      name: group.name as string,
      description: (group.description as string) ?? '',
      masterId,
      memberIds: groupMembers.filter((member) => member.group_id === group.id).map((member) => member.user_id as string),
    }))
    const pollsResult = groupIds.length
      ? await client.from('session_polls').select('id, group_id, title, status, confirmed_date, created_at, poll_dates(id, date, poll_votes(user_id, available))').in('group_id', groupIds).order('created_at', { ascending: false })
      : { data: [], error: null }
    if (pollsResult.error) throw pollsResult.error
    const polls = (pollsResult.data ?? []).map((poll) => {
      const dates = (poll.poll_dates ?? []) as Array<{ date: string; poll_votes?: Array<{ user_id: string; available: boolean }> }>
      const votes = dates.flatMap((pollDate) => (pollDate.poll_votes ?? []).map((vote) => ({
        userId: vote.user_id,
        date: pollDate.date,
        available: vote.available,
      })))
      return {
        id: poll.id as string,
        groupId: poll.group_id as string,
        title: poll.title as string,
        availableDates: dates.map((pollDate) => pollDate.date).sort(),
        votes,
        status: mapStatus(poll.status as string),
        confirmedDate: (poll.confirmed_date as string | null) ?? undefined,
        createdAt: poll.created_at as string,
      }
    })
    const tablesResult = await client.from('game_tables')
      .select('id, name, adventure_title, system, image_url, max_seats, notes')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true })
    if (tablesResult.error) throw tablesResult.error
    const rawTables = tablesResult.data ?? []
    const tableIds = rawTables.map((table) => table.id as string)
    const bookingsResult = tableIds.length
      ? await client.from('visible_seat_bookings').select('id, game_table_id, user_id, seat_number, anonymous').in('game_table_id', tableIds)
      : { data: [], error: null }
    if (bookingsResult.error) throw bookingsResult.error
    const bookings = bookingsResult.data ?? []
    const tables = rawTables.map((table) => ({
      id: table.id as string,
      name: table.name as string,
      adventureTitle: table.adventure_title as string,
      system: table.system as string,
      imageUrl: (table.image_url as string | null) ?? '',
      maxSeats: table.max_seats as number,
      notes: (table.notes as string | null) ?? '',
      seats: bookings.filter((seat) => seat.game_table_id === table.id).map((seat) => ({
        id: seat.id,
        userId: seat.user_id,
        seatNumber: seat.seat_number,
        anonymous: seat.anonymous,
      })),
    }))
    setState((previous) => ({
      ...previous,
      workspaceName: workspace.name as string,
      users,
      groups,
      polls,
      tables,
      role: membership.role as Role,
      currentUserId: user.id,
      selectedGroupId: (membership.role === 'master' && previous.selectedGroupId === 'all')
        || groups.some((group) => group.id === previous.selectedGroupId)
        ? previous.selectedGroupId
        : groups[0]?.id ?? '',
    }))
    setAuthStatus('ready')
  }, [])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    const applySession = async (session: Session | null) => {
      if (!active) return
      setAuthUser(session?.user ?? null)
      if (!session?.user) {
        setState(EMPTY_STATE)
        setAuthStatus('signedOut')
        return
      }
      setAuthStatus('loading')
      try {
        await loadWorkspace(session.user)
      } catch (loadError) {
        if (active) {
          console.error('Errore durante il caricamento dello spazio Supabase.', loadError)
          setError(getErrorMessage(loadError))
          setAuthStatus('loadError')
        }
      }
    }
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) throw sessionError
      return applySession(data.session)
    }).catch((sessionError: unknown) => {
      if (!active) return
      console.error('Impossibile ripristinare la sessione Supabase.', sessionError)
      setError(getErrorMessage(sessionError))
      setAuthStatus('signedOut')
    })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
      queueMicrotask(() => void applySession(session))
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadWorkspace])

  useEffect(() => {
    try {
      window.localStorage.removeItem('guildhall-demo-v1')
    } catch (storageError) {
      console.error('Impossibile rimuovere i vecchi dati demo dal browser.', storageError)
    }
  }, [])

  useEffect(() => {
    if (!supabase || !authUser || authStatus !== 'ready') return
    const tables = ['game_groups', 'group_members', 'session_polls', 'poll_dates', 'poll_votes', 'game_tables', 'seat_bookings']
    let refreshTimer: number | undefined
    let refreshQueued = false
    const channel = supabase.channel(`guildhall-${authUser.id}`)
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (refreshQueued) return
        refreshQueued = true
        refreshTimer = window.setTimeout(() => {
          refreshQueued = false
          void loadWorkspace(authUser).catch((refreshError: unknown) => {
            console.error('Aggiornamento realtime di Guildhall non riuscito.', refreshError)
            setError(getErrorMessage(refreshError))
          })
        }, 250)
      })
    }
    channel.subscribe((status, subscribeError) => {
      if (subscribeError) {
        console.error(`Abbonamento realtime Supabase: ${status}.`, subscribeError)
      }
    })
    return () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      void supabase?.removeChannel(channel)
    }
  }, [authStatus, authUser, loadWorkspace])

  const runMutation = useCallback(async (action: () => Promise<void>) => {
    try {
      setError(null)
      await action()
      if (authUser) await loadWorkspace(authUser)
    } catch (mutationError) {
      console.error('Operazione Guildhall non riuscita.', mutationError)
      setError(getErrorMessage(mutationError))
    }
  }, [authUser, loadWorkspace])

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient()
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const client = getSupabaseClient()
    const { data, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: window.location.origin,
      },
    })
    if (signUpError) throw signUpError
    if (!data.session || !data.user) return false
    setAuthUser(data.user)
    await loadWorkspace(data.user)
    return true
  }, [loadWorkspace])

  const signOut = useCallback(async () => {
    const client = getSupabaseClient()
    try {
      const { error: signOutError } = await client.auth.signOut()
      if (signOutError) throw signOutError
    } catch (signOutError) {
      console.error('Uscita da Guildhall non riuscita.', signOutError)
      setError(getErrorMessage(signOutError))
    }
  }, [])

  const createWorkspace = useCallback(async (name: string) => {
    const client = getSupabaseClient()
    if (!authUser) throw new Error('Accedi prima di creare uno spazio di gioco.')
    await runMutation(async () => {
      const { error: createError } = await client.rpc('create_workspace', { p_name: name.trim() })
      if (createError) throw createError
    })
  }, [authUser, runMutation])

  const joinGroup = useCallback(async (code: string) => {
    const client = getSupabaseClient()
    if (!authUser) throw new Error('Accedi prima di utilizzare un invito.')
    await runMutation(async () => {
      const { error: joinError } = await client.rpc('join_group_with_invite', { p_code: code.trim() })
      if (joinError) throw joinError
    })
  }, [authUser, runMutation])

  const createInvite = useCallback(async (groupId: string) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const { data, error: inviteError } = await client.rpc('create_group_invite', { p_group_id: groupId })
      if (inviteError) throw inviteError
      if (typeof data !== 'string') throw new Error('Il server non ha restituito un codice di invito valido.')
      setInviteCode(data)
    })
  }, [runMutation])

  const createGroup = useCallback(async (input: CreateGroupInput) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const { data, error: groupError } = await client.rpc('create_group_with_invite', {
        p_name: input.name.trim(),
        p_description: input.description.trim(),
      })
      if (groupError) throw groupError
      if (!data || typeof data !== 'object' || !('group_id' in data) || !('invite_code' in data)) {
        throw new Error('Il server non ha restituito i dettagli del gruppo e dell’invito.')
      }
      const result = data as { group_id: string; invite_code: string }
      setState((current) => ({ ...current, selectedGroupId: result.group_id }))
      setInviteCode(result.invite_code)
    })
  }, [runMutation])

  const createPoll = useCallback(async (input: CreatePollInput) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const dates: string[] = []
      const start = new Date(`${input.startDate}T12:00:00`)
      const end = new Date(`${input.endDate}T12:00:00`)
      for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        dates.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`)
      }
      if (!dates.length) throw new Error('Seleziona un intervallo di date valido.')
      const { error: pollError } = await client.rpc('create_session_poll', {
        p_group_id: input.groupId,
        p_title: input.title.trim(),
        p_dates: dates,
      })
      if (pollError) throw pollError
    })
  }, [runMutation])

  const toggleVote = useCallback(async (groupId: string, date: string) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const poll = state.polls.find((item) => item.groupId === groupId && item.status === 'active' && item.availableDates.includes(date))
      if (!poll) throw new Error('La data non appartiene a un sondaggio attivo.')
      const { data: pollDate, error: dateError } = await client.from('poll_dates').select('id').eq('poll_id', poll.id).eq('date', date).single()
      if (dateError) throw dateError
      const existing = poll.votes.find((vote) => vote.userId === state.currentUserId && vote.date === date)
      const { error: voteError } = await client.from('poll_votes').upsert({
        poll_date_id: pollDate.id,
        user_id: state.currentUserId,
        available: existing ? !existing.available : true,
      }, { onConflict: 'poll_date_id,user_id' })
      if (voteError) throw voteError
    })
  }, [runMutation, state.currentUserId, state.polls])

  const confirmSession = useCallback(async (pollId: string, date: string) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const { error: confirmError } = await client.from('session_polls')
        .update({ status: 'confirmed', confirmed_date: date })
        .eq('id', pollId)
      if (confirmError) throw confirmError
    })
  }, [runMutation])

  const createTable = useCallback(async (input: GameTableInput) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const { data: membership, error: membershipError } = await client.from('workspace_members').select('workspace_id').eq('user_id', authUser?.id).single()
      if (membershipError) throw membershipError
      const { error: tableError } = await client.from('game_tables').insert({
        workspace_id: membership.workspace_id,
        name: input.name.trim(),
        adventure_title: input.adventureTitle.trim(),
        system: input.system.trim(),
        image_url: input.imageUrl.trim() || null,
        max_seats: input.maxSeats,
        notes: input.notes.trim() || null,
      })
      if (tableError) throw tableError
    })
  }, [authUser?.id, runMutation])

  const updateTable = useCallback(async (tableId: string, input: GameTableInput) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const { error: updateError } = await client.from('game_tables').update({
        name: input.name.trim(),
        adventure_title: input.adventureTitle.trim(),
        system: input.system.trim(),
        image_url: input.imageUrl.trim() || null,
        max_seats: input.maxSeats,
        notes: input.notes.trim() || null,
      }).eq('id', tableId)
      if (updateError) throw updateError
    })
  }, [runMutation])

  const deleteTable = useCallback(async (tableId: string) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const { error: deleteError } = await client.from('game_tables').delete().eq('id', tableId)
      if (deleteError) throw deleteError
    })
  }, [runMutation])

  const toggleSeat = useCallback(async (tableId: string, seatNumber: number, anonymous: boolean) => {
    const client = getSupabaseClient()
    await runMutation(async () => {
      const existing = state.tables.find((table) => table.id === tableId)?.seats.find((seat) => seat.userId === state.currentUserId)
      if (existing) {
        const { error: removeError } = await client.from('seat_bookings').delete().eq('id', existing.id)
        if (removeError) throw removeError
      } else {
        const { error: bookingError } = await client.from('seat_bookings').insert({
          game_table_id: tableId,
          user_id: state.currentUserId,
          seat_number: seatNumber,
          anonymous,
        })
        if (bookingError) throw bookingError
      }
    })
  }, [runMutation, state.currentUserId, state.tables])

  const setView = useCallback((activeView: AppView) => setState((current) => ({ ...current, activeView })), [])
  const setSelectedGroup = useCallback((selectedGroupId: string) => setState((current) => ({ ...current, selectedGroupId })), [])
  const clearInvite = useCallback(() => setInviteCode(null), [])
  const clearError = useCallback(() => setError(null), [])
  const currentUser = useMemo(() => state.users.find((user) => user.id === state.currentUserId) ?? {
    id: authUser?.id ?? '',
    name: (authUser?.user_metadata.display_name as string) || authUser?.email || 'Avventuriero',
    role: state.role,
    color: USER_COLORS[0] ?? '#b28af6',
  }, [authUser, state.currentUserId, state.role, state.users])
  const value = useMemo(() => ({
    state,
    currentUser,
    isMaster: state.role === 'master',
    authStatus,
    error,
    inviteCode,
    signIn,
    signUp,
    signOut,
    createWorkspace,
    joinGroup,
    createInvite,
    clearInvite,
    clearError,
    setView,
    setSelectedGroup,
    toggleVote,
    confirmSession,
    createGroup,
    createPoll,
    createTable,
    updateTable,
    deleteTable,
    toggleSeat,
  }), [state, currentUser, authStatus, error, inviteCode, signIn, signUp, signOut, createWorkspace, joinGroup, createInvite, clearInvite, clearError, setView, setSelectedGroup, toggleVote, confirmSession, createGroup, createPoll, createTable, updateTable, deleteTable, toggleSeat])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
