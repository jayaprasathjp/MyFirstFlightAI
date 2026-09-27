import { useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const languages = ['English', 'हिंदी', 'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം', 'বাংলা', 'मराठी', 'ગુજરાતી', 'Bahasa Melayu', '中文', 'العربية']
const documents = [
  { key: 'ticket', title: 'Flight ticket', icon: '✈', hint: 'PDF or photo · itinerary, dates and baggage' },
  { key: 'passport', title: 'Passport', icon: '▤', hint: 'PDF or photo · identity and expiry' },
  { key: 'visa', title: 'Visa', icon: '▣', hint: 'PDF or photo · type, country and validity' },
]

const newTraveller = () => ({ id: crypto.randomUUID(), name: '', assistance: '', files: {}, extracted: {}, busy: {}, error: {} })

function App() {
  const [language, setLanguage] = useState('English')
  const [travellers, setTravellers] = useState([newTraveller()])
  const [trip, setTrip] = useState({ destination: 'Singapore', departureDate: '', returnDate: '' })
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)

  const updateTraveller = (id, update) => {
    setValidation(null)
    setTravellers((items) => items.map((traveller) => traveller.id === id ? { ...traveller, ...update } : traveller))
  }

  const setTripValue = (key, value) => {
    setValidation(null)
    setTrip((current) => ({ ...current, [key]: value }))
  }

  const uploadDocument = async (traveller, kind, file) => {
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      updateTraveller(traveller.id, { error: { ...traveller.error, [kind]: 'Choose a PDF, JPG, PNG or WebP file.' } })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      updateTraveller(traveller.id, { error: { ...traveller.error, [kind]: 'File must be 10 MB or smaller.' } })
      return
    }
    const files = { ...traveller.files, [kind]: file }
    updateTraveller(traveller.id, { files, busy: { ...traveller.busy, [kind]: true }, error: { ...traveller.error, [kind]: '' } })
    const form = new FormData()
    form.append('file', file)
    form.append('document_type', kind)
    try {
      const response = await fetch(`${API_BASE_URL}/api/extract-document`, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || data.reply || 'Could not read this document.')
      setTravellers((items) => items.map((item) => item.id === traveller.id ? { ...item, files, extracted: { ...item.extracted, [kind]: data.extracted }, busy: { ...item.busy, [kind]: false }, error: { ...item.error, [kind]: '' } } : item))
      setValidation(null)
    } catch (error) {
      setTravellers((items) => items.map((item) => item.id === traveller.id ? { ...item, files, busy: { ...item.busy, [kind]: false }, error: { ...item.error, [kind]: error.message } } : item))
    }
  }

  const runValidation = async () => {
    setValidating(true)
    setValidation(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/validate-trip`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: trip.destination, departure_date: trip.departureDate, return_date: trip.returnDate, travellers: travellers.map(({ name, assistance, extracted }) => ({ name, assistance, documents: extracted })) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Validation failed.')
      setValidation(data)
    } catch (error) {
      setValidation({ error: error.message })
    } finally { setValidating(false) }
  }

  const readyToValidate = travellers.every((person) => ['ticket', 'passport', 'visa'].every((kind) => person.extracted[kind]) && !Object.values(person.busy).some(Boolean)) && trip.departureDate && trip.returnDate

  return (
    <main className="page-shell">
      <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">✈</span><span>FirstFlight<span className="brand-ai"> AI</span></span></a><span className="prototype-tag"><i /> TRAVEL COMPANION</span></header>
      <section className="intro" id="top"><div className="eyebrow"><span /> YOUR JOURNEY, MADE CLEARER</div><h1>Every first flight<br /><em>starts with a plan.</em></h1><p>Choose your language, add your travellers, and we’ll help you check the details before you fly.</p></section>
      <div className="stepper" aria-label="Setup progress"><div className="step active"><span>01</span><b>Language</b></div><div className="step-line" /><div className="step active"><span>02</span><b>Travellers</b></div><div className="step-line" /><div className={`step ${validation ? 'active' : ''}`}><span>03</span><b>Review</b></div></div>

      <section className="section-card language-card"><div className="section-heading"><div><div className="section-kicker">STEP 01</div><h2>Choose your language</h2><p>We’ll use this for your guidance and travel help.</p></div><span className="heading-icon">文</span></div><div className="language-grid">{languages.map((item) => <button key={item} className={`language-option ${language === item ? 'selected' : ''}`} onClick={() => setLanguage(item)}>{item}{language === item && <span>✓</span>}</button>)}</div></section>

      <div className="traveller-header"><div><div className="section-kicker">STEP 02</div><h2>Your travellers</h2><p>Add each person travelling on this trip. Documents are processed securely for this session.</p></div><button className="add-button" onClick={() => { setTravellers((items) => [...items, newTraveller()]); setValidation(null) }}><span>＋</span> Add traveller</button></div>

      <div className="traveller-list">{travellers.map((person, index) => <article className="traveller-card" key={person.id}><div className="traveller-title"><div className="traveller-avatar">{String(index + 1).padStart(2, '0')}</div><div><h3>Traveller {index + 1}</h3><span>Passenger details and documents</span></div>{travellers.length > 1 && <button className="remove-button" aria-label={`Remove traveller ${index + 1}`} onClick={() => { setTravellers((items) => items.filter((item) => item.id !== person.id)); setValidation(null) }}>Remove</button>}</div>
        <label className="field-label">Name on documents <span>Use the spelling shown on the passport</span><input className="text-field" placeholder="e.g. Goutam Kumar" value={person.name} onChange={(event) => updateTraveller(person.id, { name: event.target.value })} /></label>
        <div className="upload-heading"><div><h4>Travel documents</h4><p>Upload a clear photo or PDF for each document.</p></div><span className="secure-note">⌑ PRIVATE UPLOAD</span></div>
        <div className="document-grid">{documents.map((doc) => <label className={`document-upload ${person.extracted[doc.key] ? 'uploaded' : ''}`} key={doc.key}><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => uploadDocument(person, doc.key, event.target.files?.[0])} /><span className="document-icon">{doc.icon}</span><span className="document-title">{doc.title}</span><span className="document-hint">{doc.hint}</span><span className="upload-action">{person.busy[doc.key] ? 'Reading document…' : person.extracted[doc.key] ? '✓ Extracted · replace' : '＋ Choose file'}</span>{person.files[doc.key] && <span className="file-name">{person.files[doc.key].name}</span>}{person.error[doc.key] && <span className="upload-error">{person.error[doc.key]}</span>}{person.extracted[doc.key] && <span className="extracted-preview">{Object.entries(person.extracted[doc.key]).filter(([, value]) => value && typeof value !== 'object').slice(0, 3).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ')}</span>}</label>)}</div>
        <label className="field-label assistance-label">Need assistance at the airport? <span>Optional</span><select className="text-field" value={person.assistance} onChange={(event) => updateTraveller(person.id, { assistance: event.target.value })}><option value="">No assistance selected</option><option value="wheelchair">Wheelchair assistance</option><option value="mobility">Help with walking / mobility</option><option value="visual">Visual assistance</option><option value="elderly">Elderly traveller support</option><option value="other">Other assistance</option></select></label>
      </article>)}</div>

      <section className="section-card trip-card"><div className="section-heading"><div><div className="section-kicker">TRIP DETAILS</div><h2>When are you travelling?</h2><p>Used to check passport and visa dates against your trip.</p></div><span className="heading-icon">↗</span></div><div className="trip-fields"><label className="field-label">Destination<input className="text-field" value={trip.destination} onChange={(event) => setTripValue('destination', event.target.value)} placeholder="e.g. Singapore" /></label><label className="field-label">Departure date<input className="text-field" type="date" value={trip.departureDate} onChange={(event) => setTripValue('departureDate', event.target.value)} /></label><label className="field-label">Return date<input className="text-field" type="date" value={trip.returnDate} onChange={(event) => setTripValue('returnDate', event.target.value)} /></label></div></section>

      <section className="review-area"><div><div className="section-kicker">STEP 03</div><h2>Check your documents</h2><p>We’ll compare names and dates, then show anything you may need to review.</p></div><button className="review-button" onClick={runValidation} disabled={!readyToValidate || validating}>{validating ? <><span className="spinner" /> Checking documents</> : <>Run document check <span>→</span></>}</button></section>
      {validation && <section className={`result-card ${validation.error || validation.status === 'review' ? 'needs-review' : ''}`}><div className="result-icon">{validation.error ? '!' : validation.status === 'ready' ? '✓' : '!'}</div><div className="result-content"><div className="section-kicker">DOCUMENT REVIEW</div><h2>{validation.error ? 'Could not complete the check' : validation.status === 'ready' ? 'Your documents look ready' : 'A few things need your attention'}</h2>{validation.error ? <p>{validation.error}</p> : <><p>This is an automated check of the details extracted from your uploads. Confirm any uncertain information with your airline or the relevant authorities.</p><ul>{validation.checks?.map((check, i) => <li key={i}><span className={check.status === 'pass' ? 'check-pass' : 'check-warn'}>{check.status === 'pass' ? '✓' : '!'}</span><span><b>{check.title}</b>{check.message && <small>{check.message}</small>}</span></li>)}</ul></>}</div></section>}
      <footer className="page-footer"><span>FirstFlight AI · Travel with confidence</span><span>Document details are used only to help prepare your trip.</span></footer>
    </main>
  )
}

export default App
