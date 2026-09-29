import { useCallback, useEffect, useRef, useState } from 'react'
import { api, store } from './api'
import { useI18n } from './i18n'
import I18nProvider from './I18nProvider'
import { LANGUAGES } from './strings'
import LanguageScreen from './screens/LanguageScreen'
import TravellersScreen from './screens/TravellersScreen'
import CheckScreen from './screens/CheckScreen'
import ChecklistScreen from './screens/ChecklistScreen'
import ContactsScreen from './screens/ContactsScreen'
import JourneyScreen from './screens/JourneyScreen'
import LostCard from './components/LostCard'
import HelpSheet from './components/HelpSheet'
import './App.css'

const STEPS = ['language', 'travellers', 'check', 'contacts', 'checklist', 'journey']

function TopBar({ onLanguage, busy }) {
  const { lang, t } = useI18n()
  return (
    <header className="top">
      <div className="brand"><span className="mark" aria-hidden="true">✈</span><span>MyFirstFlight</span></div>
      <select className="lang" aria-label={t('language_label')} value={lang} disabled={busy} onChange={(e) => onLanguage(e.target.value)}>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
      </select>
    </header>
  )
}

function Stepper({ step, allowed, onGo }) {
  const { t } = useI18n()
  return (
    <nav className="stepper" aria-label="Progress">
      {STEPS.map((s, i) => (
        <button key={s} className={s === step ? 'on' : STEPS.indexOf(step) > i ? 'past' : ''}
          disabled={!allowed(s)} aria-current={s === step ? 'step' : undefined} onClick={() => onGo(s)}>
          <i>{i + 1}</i><span>{t('step_' + s)}</span>
        </button>
      ))}
    </nav>
  )
}

function Flow({ setLang }) {
  const { t } = useI18n()
  const [trip, setTrip] = useState(() => store.get('mff-trip-cache', null))
  const [step, setStepState] = useState(() => (store.get('mff-trip', null) ? store.get('mff-step', 'travellers') : 'language'))
  const [done, setDone] = useState(() => store.get(`mff-done-${store.get('mff-trip', '')}`, {}))
  const [busy, setBusy] = useState(false)
  const [updating, setUpdating] = useState(false) // language switch: server re-translates checks + checklist
  const [error, setError] = useState('')
  const [lostOpen, setLostOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef(null)
  const saveQueue = useRef(Promise.resolve())

  const closeLost = useCallback(() => setLostOpen(false), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  const toast = (msg) => { setToastMsg(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastMsg(''), 3000) }

  const setStep = (s) => { setStepState(s); store.set('mff-step', s); window.scrollTo({ top: 0 }) }
  const applyTrip = (tr) => {
    setTrip(tr)
    store.set('mff-trip', tr.id)
    store.set('mff-trip-cache', tr)
    setDone(Object.fromEntries(tr.checklist.items.filter((i) => i.done).map((i) => [i.id, true])))
  }
  const fail = (e) => setError(e.message === 'network' ? t('err_network') : e.message)

  // Load the saved trip on start (falls back to the cached copy when offline).
  useEffect(() => {
    const id = store.get('mff-trip', null)
    if (!id) return
    api.getTrip(id).then(applyTrip).catch((e) => {
      if (e.status === 404) { ['mff-trip', 'mff-trip-cache', 'mff-step'].forEach(store.del); setTrip(null); setStepState('language') }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async (fn) => {
    setBusy(true); setError('')
    try { await fn(); return true } catch (e) { fail(e); return false } finally { setBusy(false) }
  }

  const pickLanguage = (code) => run(async () => {
    setLang(code)
    applyTrip(trip ? await api.setLanguage(trip.id, code) : await api.createTrip(code))
    if (step === 'language') setStep('travellers')
  })
  const changeLanguage = async (code) => {
    setLang(code)
    if (!trip) return
    setUpdating(true)
    await run(async () => applyTrip(await api.setLanguage(trip.id, code)))
    setUpdating(false)
  }
  const addTraveller = (files, assistance) => run(async () => applyTrip(await api.addTraveller(trip.id, files, assistance)))
  const removeTraveller = (tid) => run(async () => applyTrip(await api.removeTraveller(trip.id, tid)))
  const saveContacts = (contacts) => run(async () => { applyTrip(await api.saveContacts(trip.id, contacts)); setStep('checklist') })
  const saveBoarding = (gate, time) => run(async () => applyTrip(await api.saveBoarding(trip.id, gate, time)))
  const toggle = (itemId) => {
    const next = { ...done, [itemId]: !done[itemId] }
    setDone(next)
    store.set(`mff-done-${trip.id}`, next)
    // Serialize saves so an older request never overwrites a newer one.
    saveQueue.current = saveQueue.current.then(() => api.saveChecklist(trip.id, next)).catch(() => {})
  }
  const startOver = () => {
    if (!window.confirm(t('start_over_confirm'))) return
    ;['mff-trip', 'mff-trip-cache', 'mff-step'].forEach(store.del)
    setTrip(null); setDone({}); setStep('language')
  }

  const hasTravellers = !!trip && trip.travellers.length > 0
  const allowed = (s) => s === 'language' || (trip && (s === 'travellers' || hasTravellers))

  return (
    <div className="app">
      <TopBar onLanguage={changeLanguage} busy={busy} />
      <Stepper step={step} allowed={allowed} onGo={setStep} />
      <main className="screen">
        {updating && <div className="reading" role="status"><span className="spin" aria-hidden="true"></span>{t('updating')}</div>}
        {error && step !== 'travellers' && <div className="err" role="alert">{error}</div>}
        {step === 'language' && <LanguageScreen onPick={pickLanguage} busy={busy} />}
        {step === 'travellers' && trip && (
          <TravellersScreen trip={trip} busy={busy} error={error} onAdd={addTraveller} onRemove={removeTraveller}
            onNext={() => setStep('check')} />
        )}
        {step === 'check' && trip && <CheckScreen trip={trip} onBack={() => setStep('travellers')} onNext={() => setStep('contacts')} />}
        {step === 'contacts' && trip && <ContactsScreen key={trip.id} trip={trip} busy={busy} onSave={saveContacts} />}
        {step === 'checklist' && trip && (
          <>
            <ChecklistScreen checklist={trip.checklist} done={done} onToggle={toggle} />
            <button className="btn pri full" onClick={() => setStep('journey')}>{t('go_airport')} →</button>
          </>
        )}
        {step === 'journey' && trip && <JourneyScreen trip={trip} busy={busy} onSaveBoarding={saveBoarding} toast={toast} />}
        {step !== 'language' && !trip && <p className="muted">{t('loading')}</p>}
      </main>
      {trip && <footer className={'foot' + (hasTravellers ? ' dock-pad' : '')}><button className="link" onClick={startOver}>{t('start_over')}</button></footer>}
      {hasTravellers && (
        <div className="dock">
          <button className="helpbtn" onClick={() => setHelpOpen(true)}><span aria-hidden="true">?</span>{t('help_btn')}</button>
          <button className="sos" onClick={() => setLostOpen(true)}><span aria-hidden="true">!</span>{t('lost')}</button>
        </div>
      )}
      {helpOpen && hasTravellers && <HelpSheet trip={trip} onTrip={applyTrip} onClose={closeHelp} toast={toast} />}
      {lostOpen && hasTravellers && <LostCard trip={trip} onTrip={applyTrip} onClose={closeLost} toast={toast} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  )
}

export default function App() {
  const [lang, setLangState] = useState(() => store.get('mff-lang', 'en'))
  const setLang = (l) => { setLangState(l); store.set('mff-lang', l) }
  return (
    <I18nProvider lang={lang}>
      <Flow setLang={setLang} />
    </I18nProvider>
  )
}
