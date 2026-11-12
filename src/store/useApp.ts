import { useContext } from 'react'
import { AppContext } from './context'

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp deve essere usato all’interno di AppProvider.')
  return context
}
