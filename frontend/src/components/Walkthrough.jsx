import { useCallback, useState } from 'react'
import { useI18n } from '../i18n'
import LanguageScreen from '../screens/LanguageScreen'
import TravellersScreen from '../screens/TravellersScreen'
import CheckScreen from '../screens/CheckScreen'
import ContactsScreen from '../screens/ContactsScreen'
import ChecklistScreen from '../screens/ChecklistScreen'
import JourneyScreen from '../screens/JourneyScreen'
import HelpSheet from './HelpSheet'
import LostCard from './LostCard'
import TourPlayer, { PhoneFrame } from './TourPlayer'

// A sample screen recording (same for everyone) can still be downloaded; the tour itself is built live.
const SAMPLE_VIDEO = '/walkthrough/app-overview.mp4'
const noop = () => {}

function Dock() {
  const { t } = useI18n()
  return (
    <div className="dock">
      <span className="helpbtn"><span>?</span>{t('help_btn')}</span>
      <span className="sos"><span>!</span>{t('lost')}</span>
    </div>
  )
}

// App walkthrough: every page of the real app, read-only, shown with this user's own trip and narrated.
function tourScenes(trip, t) {
  const done = Object.fromEntries(trip.checklist.items.filter((i) => i.done).map((i) => [i.id, true]))
  const scene = (id, step, screen) => ({ id, step, screen, title: t(`wt_${id}`), body: t(`wt_${id}_say`) })
  return [
    scene('lang', null, <LanguageScreen onPick={noop} />),
    scene('upload', 0, <TravellersScreen trip={trip} onAdd={noop} onRemove={noop} onReplaceDoc={noop} onNext={noop} toast={noop} />),
    scene('check', 1, <><CheckScreen trip={trip} onBack={noop} onNext={noop} onAnswer={noop} onHelpIntro={noop} toast={noop} /><Dock /></>),
    scene('contacts', 2, <><ContactsScreen trip={trip} onSave={noop} toast={noop} /><Dock /></>),
    scene('checklist', 3, <><ChecklistScreen checklist={trip.checklist} done={done} onToggle={noop} toast={noop} /><Dock /></>),
    scene('day', 4, <><JourneyScreen trip={trip} onSaveBoarding={noop} toast={noop} /><Dock /></>),
    scene('help', 4, <HelpSheet trip={trip} onTrip={noop} onClose={noop} toast={noop} />),
    scene('lost', 4, <LostCard trip={trip} onTrip={noop} onClose={noop} toast={noop} />),
  ].map((sc) => ({ ...sc, say: `${sc.title}. ${sc.body}` }))
}

// Small still of the user's own Travellers page, used as the card's thumbnail.
function Thumb({ trip }) {
  return (
    <PhoneFrame className="wt-thumb">
      <div className="app"><main className="screen">
        <TravellersScreen trip={trip} onAdd={noop} onRemove={noop} onReplaceDoc={noop} onNext={noop} toast={noop} />
      </main></div>
    </PhoneFrame>
  )
}

export default function Walkthrough({ trip }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  if (!trip?.travellers?.length) return null
  return (
    <section className="card walkthrough">
      <button className="wt-tile" onClick={() => setOpen(true)} aria-label={t('wt_title')}>
        <Thumb trip={trip} />
        <span className="wt-play" aria-hidden="true">▶</span>
      </button>
      <div className="wt-text">
        <h3>{t('wt_title')}</h3>
        <span className="muted">{t('wt_hint')}</span>
        <div className="wt-actions">
          <button className="btn sec" onClick={() => setOpen(true)}>▶ {t('wt_watch')}</button>
          <a className="btn sec" href={SAMPLE_VIDEO} download="MyFirstFlight-app-walkthrough.mp4">⬇ {t('wt_download')}</a>
        </div>
      </div>
      {open && (
        <TourPlayer heading={t('wt_title')} scenes={tourScenes(trip, t)} endTitle={t('wt_end')}
          onClose={close} onDone={close} doneLabel={t('close')} />
      )}
    </section>
  )
}
