import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'
import { speak, useRecorder } from '../voice'

const TABS = ['ask', 'staff', 'pass', 'assist']

// Mic button + text box shared by "Ask" and "Show staff". onSend({ text } | { audio }).
function VoiceInput({ onSend, busy, toast }) {
  const { t } = useI18n()
  const { recording, start, stop } = useRecorder()
  const [text, setText] = useState('')
  const mic = async () => {
    if (recording) {
      const audio = await stop()
      if (audio?.size) onSend({ audio })
      return
    }
    try { await start() } catch { toast(t('mic_denied')) }
  }
  return (
    <div className="voicein">
      <button className={'micbtn' + (recording ? ' rec' : '')} onClick={mic} disabled={busy} aria-label={recording ? t('listening') : t('tab_ask')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </button>
      <span className="muted small">{recording ? t('listening') : busy ? t('thinking') : ''}</span>
      <form className="typein" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend({ text: text.trim() }); setText('') } }}>
        <input type="text" value={text} placeholder={t('type_question')} onChange={(e) => setText(e.target.value)} disabled={busy} />
        <button className="btn pri" disabled={busy || !text.trim()}>{t('send')}</button>
      </form>
    </div>
  )
}

function AskTab({ trip, toast }) {
  const { lang, t } = useI18n()
  const [chat, setChat] = useState([])
  const [busy, setBusy] = useState(false)
  // Speak in the language the traveller used (detected by Gemini), else the app language.
  const play = async (text, language) => { if (!(await speak(text, language || lang))) toast(t('no_voice')) }
  const send = async (q) => {
    setBusy(true)
    try {
      const r = await api.ask(trip.id, q)
      setChat((c) => [...c, r])
      play(r.answer, r.language)
    } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  return (
    <>
      <p className="muted">{t('ask_hint')}</p>
      <VoiceInput onSend={send} busy={busy} toast={toast} />
      <div className="chat">
        {chat.map((m, i) => (
          <div key={i} className="qa-pair">
            <div className="bub me">{m.question}</div>
            <div className="bub ai" lang={m.language}>{m.answer}<button className="link" onClick={() => play(m.answer, m.language)}>🔊 {t('play')}</button></div>
          </div>
        ))}
      </div>
    </>
  )
}

function StaffTab({ trip, toast }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [phrase, setPhrase] = useState(null)
  const [big, setBig] = useState(false)
  const send = async (q) => {
    setBusy(true)
    try { setPhrase(await api.toEnglish(trip.id, q)); setBig(true) } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  return (
    <>
      <p className="muted">{t('staff_hint')}</p>
      <VoiceInput onSend={send} busy={busy} toast={toast} />
      {phrase && (
        <button className="say" onClick={() => setBig(true)}>
          <small>{t('show_staff')}</small><b lang="en">{phrase.english}</b><span className="loc">{phrase.original}</span>
        </button>
      )}
      {big && phrase && (
        <div className="bigtext" role="dialog" aria-label={t('show_staff')} onClick={() => setBig(false)}>
          <p lang="en">{phrase.english}</p>
          <button className="btn sec">{t('close')}</button>
        </div>
      )}
    </>
  )
}

function PassTab({ trip, onTrip, toast }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    try { onTrip(await api.boardingPass(trip.id, file)); toast(t('pass_saved')) } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const bp = trip.boarding_pass
  return (
    <>
      <p className="muted">{t('pass_hint')}</p>
      <label className="btn pri full filebtn">
        📷 {t('pass_photo')}
        <input type="file" accept="image/*,application/pdf" capture="environment" disabled={busy} onChange={(e) => upload(e.target.files[0])} />
      </label>
      {busy && <div className="reading" role="status"><span className="spin" aria-hidden="true"></span>{t('reading_pass')}</div>}
      {bp && (
        <div className="bpfields">
          {bp.fields.map((f, i) => (
            <div key={i} className={/gate|board/i.test(f.field) ? 'hl' : ''}>
              <span>{f.field}</span><b>{f.value}</b><small>{f.meaning}</small>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function AssistTab({ trip, onTrip, toast }) {
  const { t } = useI18n()
  const [who, setWho] = useState(trip.travellers[0]?.id)
  const [kind, setKind] = useState(trip.travellers[0]?.assistance === 'visually_impaired' ? 'visual' : 'wheelchair')
  const [loc, setLoc] = useState('entrance')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const submit = async () => {
    setBusy(true)
    try {
      const r = await api.assist(trip.id, { traveller_id: who, kind, location: loc })
      setLast(r.request)
      onTrip(r.trip)
    } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="form">
      <p className="muted">{t('assist_hint')}</p>
      {trip.travellers.length > 1 && (
        <label>{t('for_whom')}
          <select value={who} onChange={(e) => setWho(e.target.value)}>{trip.travellers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
      )}
      <fieldset className="seg one">
        {['wheelchair', 'escort', 'visual'].map((k) => (
          <label key={k}><input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />{t('kind_' + k)}</label>
        ))}
      </fieldset>
      <label>{t('where_now')}
        <select value={loc} onChange={(e) => setLoc(e.target.value)}>
          {['entrance', 'checkin', 'security', 'gate', 'arrival'].map((l) => <option key={l} value={l}>{t('loc_' + l)}</option>)}
        </select>
      </label>
      <button className="btn pri full" onClick={submit} disabled={busy}>{t('request_btn')}</button>
      {last && (
        <div className="ticketbox" role="status">
          <small>{t('request_no')}</small><b className="m">{last.id}</b>
          <span>{last.sent_to_desk ? t('sent_desk') : t('saved_desk')}</span>
        </div>
      )}
      {trip.assist_requests.length > 0 && (
        <>
          <h3>{t('my_requests')}</h3>
          {trip.assist_requests.slice().reverse().map((r) => (
            <div key={r.id} className="reqrow"><b className="m">{r.id}</b><span>{r.traveller} · {t(r.kind === 'lost' ? 'lost' : 'kind_' + r.kind)}</span></div>
          ))}
        </>
      )}
    </div>
  )
}

export default function HelpSheet({ trip, onTrip, onClose, toast }) {
  const { t } = useI18n()
  const [tab, setTab] = useState('ask')
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const props = { trip, onTrip, toast }
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t('helpers_title')}>
      <div className="sheethead">
        <h2>{t('helpers_title')}</h2>
        <button ref={closeRef} className="btn sec" onClick={onClose}>{t('close')}</button>
      </div>
      <div className="tabs4" role="tablist">
        {TABS.map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t('tab_' + k)}</button>)}
      </div>
      {tab === 'ask' && <AskTab {...props} />}
      {tab === 'staff' && <StaffTab {...props} />}
      {tab === 'pass' && <PassTab {...props} />}
      {tab === 'assist' && <AssistTab {...props} />}
    </div>
  )
}
