import { useI18n } from '../i18n'
import { speak } from '../voice'

// Compact read-aloud button: for someone who can speak and understand but not read.
// `text` may be a string or a function returning one, so callers can build it lazily.
export default function Listen({ text, toast, className = '' }) {
  const { lang, t } = useI18n()
  const play = async (e) => {
    e.preventDefault(); e.stopPropagation() // safe inside a <label> or a row that has its own onClick
    const value = typeof text === 'function' ? text() : text
    if (!value) return
    if (!(await speak(value, lang))) toast(t('no_voice'))
  }
  return (
    <button type="button" className={`listenbtn ${className}`} aria-label={t('read_aloud')} onClick={play}>🔊</button>
  )
}
