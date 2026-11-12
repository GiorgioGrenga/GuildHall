import { createContext } from 'react'
import type { AppState, AppView, AuthStatus, CreateGroupInput, CreatePollInput, GameTableInput, User } from '../types'

export interface AppContextValue {
  state: AppState
  currentUser: User
  isMaster: boolean
  authStatus: AuthStatus
  error: string | null
  inviteCode: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  joinGroup: (code: string) => Promise<void>
  createInvite: (groupId: string) => Promise<void>
  clearInvite: () => void
  clearError: () => void
  setView: (view: AppView) => void
  setSelectedGroup: (groupId: string) => void
  toggleVote: (groupId: string, date: string) => Promise<void>
  confirmSession: (pollId: string, date: string) => Promise<void>
  createGroup: (input: CreateGroupInput) => Promise<void>
  createPoll: (input: CreatePollInput) => Promise<void>
  createTable: (input: GameTableInput) => Promise<void>
  updateTable: (tableId: string, input: GameTableInput) => Promise<void>
  deleteTable: (tableId: string) => Promise<void>
  toggleSeat: (tableId: string, seatNumber: number, anonymous: boolean) => Promise<void>
}

export const AppContext = createContext<AppContextValue | null>(null)
