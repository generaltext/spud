import { createContext, useContext } from 'react'

// Cross-view UI state: which idea the drawer shows, and the active tag filter.
// The selected idea rides a URL search param (linkable, Esc/close clears it), so
// the drawer opens consistently over whatever view you're in.
export interface Ui {
  selectedId: string | null
  openIdea: (id: string) => void
  closeIdea: () => void
  activeTags: string[]
  toggleTag: (label: string) => void
  focusNewIdea: () => void
}

export const UiContext = createContext<Ui | null>(null)

export function useUi(): Ui {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used within the Layout provider')
  return ctx
}
