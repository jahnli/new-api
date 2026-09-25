import { createContext } from 'react'

// Components with automatic hints should defer to a surrounding trigger.
export const TooltipTriggerContext = createContext(false)
