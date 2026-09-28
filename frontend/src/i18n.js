import { createContext, useContext } from 'react'

export const I18nCtx = createContext(null)
export const useI18n = () => useContext(I18nCtx)
