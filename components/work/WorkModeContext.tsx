'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

export type WorkMode = 'advisor' | 'copilot' | 'autopilot'

interface WorkModeContextType {
  mode: WorkMode
  setMode: (mode: WorkMode) => void
}

const WorkModeContext = createContext<WorkModeContextType>({
  mode: 'copilot',
  setMode: () => {},
})

export function WorkModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<WorkMode>('copilot')

  const setMode = useCallback((m: WorkMode) => {
    setModeState(m)
  }, [])

  return (
    <WorkModeContext.Provider value={{ mode, setMode }}>
      {children}
    </WorkModeContext.Provider>
  )
}

export function useWorkMode() {
  return useContext(WorkModeContext)
}
