export type Role = 'master' | 'player'
export type AppView = 'calendar' | 'tables'
export type PollStatus = 'active' | 'confirmed' | 'closed'
export type AuthStatus = 'loading' | 'signedOut' | 'needsWorkspace' | 'ready' | 'loadError'

export interface User {
  id: string
  name: string
  role: Role
  color: string
  avatarUrl: string
}

export interface Workspace {
  id: string
  name: string
  role: Role
}

export interface GameRoom {
  id: string
  name: string
  description: string
}

export interface Group {
  id: string
  name: string
  description: string
  masterId: string
  memberIds: string[]
}

export interface PollVote {
  userId: string
  date: string
  available: boolean
}

export interface SessionPoll {
  id: string
  groupId: string
  title: string
  availableDates: string[]
  votes: PollVote[]
  status: PollStatus
  confirmedDate?: string
  createdAt: string
}

export interface SeatBooking {
  id: string
  userId: string | null
  seatNumber: number
  anonymous: boolean
}

export interface GameTable {
  id: string
  roomId: string
  masterUserId: string | null
  name: string
  adventureTitle: string
  system: string
  imageUrl: string
  maxSeats: number
  notes: string
  seats: SeatBooking[]
}

export interface AppState {
  workspaces: Workspace[]
  selectedWorkspaceId: string
  workspaceName: string
  users: User[]
  groups: Group[]
  polls: SessionPoll[]
  tables: GameTable[]
  rooms: GameRoom[]
  selectedRoomId: string
  role: Role
  currentUserId: string
  selectedGroupId: string
  activeView: AppView
}

export interface CreateGroupInput {
  name: string
  description: string
}

export interface CreatePollInput {
  groupId: string
  title: string
  startDate: string
  endDate: string
}

export type GameTableInput = Omit<GameTable, 'id' | 'seats'>
