import { useI18n } from '../i18n'
import { LANGUAGES } from '../strings'
import Listen from '../components/Listen'
import Icon from '../components/Icon'

export default function LanguageScreen({ onPick, busy, toast, onStory }) {
  const { lang, t } = useI18n()
  return (
    <>
      <div className="gh"><h2>{t('choose_language')}</h2><Listen text={`${t('choose_language')}. ${t('choose_language_hint')}`} toast={toast} /></div>
      <p className="muted">{t('choose_language_hint')}</p>
      {onStory && <button className="btn sec full storybtn" onClick={onStory}><Icon name="speaker" /> {t('story_title')}</button>}
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
