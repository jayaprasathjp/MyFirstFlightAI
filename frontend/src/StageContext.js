import { createContext, useContext } from 'react'

// The airport floor plan in the Stage shows where the traveller is; JourneyScreen reports its current step here.
export const StageCtx = createContext({ jstep: 0, setJstep: () => {} })
export const useStage = () => useContext(StageCtx)
