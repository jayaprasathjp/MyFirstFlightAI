import { useI18n } from '../i18n'
import { LANGUAGES } from '../strings'

export default function LanguageScreen({ onPick, busy }) {
  const { lang, t } = useI18n()
  return (
    <>
      <h2>{t('choose_language')}</h2>
      <p className="muted">{t('choose_language_hint')}</p>
      <div className="langs">
        {LANGUAGES.map((l) => (
          <button key={l.code} className={l.code === lang ? 'on' : ''} disabled={busy} onClick={() => onPick(l.code)}>
            <b lang={l.code}>{l.native}</b>
            <span>{l.english}</span>
          </button>
        ))}
      </div>
    </>
  )
}
