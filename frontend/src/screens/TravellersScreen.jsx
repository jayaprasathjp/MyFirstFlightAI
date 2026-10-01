import { useState, useEffect } from 'react'
import { api, errorText } from '../api'
import { useI18n } from '../i18n'
import Listen from '../components/Listen'

const DOCS = ['ticket', 'passport', 'visa']
const ASSIST = ['none', 'elderly', 'wheelchair', 'visually_impaired']

// One recognizable pictogram per document, so the three slots are tellable apart without reading the label.
const DOC_ICON = {
  ticket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 9a2 2 0 0 0 0 4v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-4V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
      <path d="M14 5v13" strokeDasharray="2.5 2.5" />
    </svg>
  ),
  passport: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="9" r="2.3" />
      <path d="M9 15.5h6" />
    </svg>
  ),
  visa: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <circle cx="13.5" cy="14.5" r="4" />
      <path d="M11.8 14.5l1.2 1.2 2.2-2.4" />
    </svg>
  ),
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const ReplaceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16M3 21v-5h5" />
  </svg>
)
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M9 7V4h6v3m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

export function TripCard({ summary }) {
  const { t, fmtDate } = useI18n()
  if (!summary) return null
  return (
    <div className="boarding">
      <div className="row">
        <div><div className="iata">{summary.origin_code}</div><div className="city">{summary.origin_city} · {summary.departure_time}</div></div>
        <div className="plane" aria-hidden="true"><i></i>✈<i></i></div>
        <div className="end"><div className="iata">{summary.destination_code}</div><div className="city">{summary.destination_city} · {summary.arrival_time}</div></div>
      </div>
      <div className="meta">
        <div><span>{t('flight')}</span><b>{summary.flights.join(' + ')}</b></div>
        <div><span>{t('date')}</span><b>{fmtDate(summary.departure_date)}</b></div>
        <div><span>{t('cabin')}</span><b>{summary.cabin_bag_kg ? `${summary.cabin_bag_kg} kg` : '—'}</b></div>
        <div><span>{t('checked')}</span><b>{summary.checked_bag_kg ? `${summary.checked_bag_kg} kg` : '—'}</b></div>
      </div>
    </div>
  )
}

function AddTravellerForm({ onCancel, onSubmit, busy, canCancel }) {
  const { t } = useI18n()
  const [files, setFiles] = useState({ ticket: null, passport: null, visa: null })
  const [assistance, setAssistance] = useState('none')
  const [err, setErr] = useState('')

  const submit = () => {
    if (DOCS.some((d) => !files[d])) return setErr(t('err_files'))
    setErr('')
    onSubmit(files, assistance)
  }
  return (
    <div className="card form">
      <div className="drop">
        {DOCS.map((d) => (
          <label key={d} className={files[d] ? 'has' : ''}>
            <span className="docicon" aria-hidden="true">{files[d] ? '✓' : DOC_ICON[d]}</span>
            <b>{t(d)}</b>
            <small>{files[d] ? files[d].name : t('tap_to_add')}</small>
            <input type="file" accept="image/*,application/pdf" disabled={busy}
              onChange={(e) => { setFiles((f) => ({ ...f, [d]: e.target.files[0] || null })); setErr('') }} />
          </label>
        ))}
      </div>
      <fieldset className="seg">
        <legend>{t('needs_assistance')}</legend>
        {ASSIST.map((a) => (
          <label key={a}>
            <input type="radio" name="assist" value={a} checked={assistance === a} disabled={busy} onChange={() => setAssistance(a)} />
            {t('assist_' + a)}
          </label>
        ))}
      </fieldset>
      {err && <div className="err" role="alert">{err}</div>}
      {busy && <div className="reading" role="status"><span className="spin" aria-hidden="true"></span>{t('reading')}</div>}
      <div className={canCancel ? 'row2' : ''}>
        {canCancel && <button className="btn sec" onClick={onCancel} disabled={busy}>{t('cancel')}</button>}
        <button className="btn pri full" onClick={submit} disabled={busy}>{t('check_documents')}</button>
      </div>
    </div>
  )
}

// One document row on a traveller card: type icon, label, and icon-only View/Replace actions.
function DocRow({ trip, p, d, replacing, onView, onReplace, busy }) {
  const { t } = useI18n()
  const data = p.documents[d]
  if (!data) return null
  const isReplacing = replacing === `${p.id}:${d}`
  return (
    <div className="docrow">
      <span className="docicon sm" aria-hidden="true">{DOC_ICON[d]}</span>
      <b>{t(d)}</b>
      <span className="docrow-actions">
        <button type="button" className="iconbtn" aria-label={`${t('view')} ${t(d)}`}
          onClick={() => onView(trip.id, p.id, d, `${p.name} - ${t(d)}`)}>
          <EyeIcon />
        </button>
        <label className={'iconbtn filebtn' + (isReplacing ? ' busy' : '')} aria-label={`${t('replace')} ${t(d)}`}>
          {isReplacing ? <span className="spin" aria-hidden="true" /> : <ReplaceIcon />}
          <input type="file" accept="image/*,application/pdf" disabled={busy || !!replacing}
            onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; onReplace(p.id, d, f) }} />
        </label>
      </span>
    </div>
  )
}

export default function TravellersScreen({ trip, onAdd, onRemove, onReplaceDoc, onNext, busy, error, toast }) {
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(null)
  const [docLoading, setDocLoading] = useState(false)
  const [replacing, setReplacing] = useState(null) // `${travellerId}:${doc}` while a replace is in flight
  const showForm = adding || trip.travellers.length === 0

  const replace = async (travellerId, doc, file) => {
    if (!file) return
    setReplacing(`${travellerId}:${doc}`)
    await onReplaceDoc(travellerId, doc, file)
    setReplacing(null)
  }
  // getFileUrl fetches the document with the auth header and returns a blob URL (the endpoint requires a session).
  const view = async (tripId, travellerId, doc, name) => {
    setViewingDoc({ url: null, name })
    setDocLoading(true)
    try {
      const url = await api.getFileUrl(tripId, travellerId, doc)
      setViewingDoc({ url, name })
    } catch (err) {
      toast(errorText(err, t))
      setViewingDoc(null)
      setDocLoading(false)
    }
  }

  useEffect(() => {
    document.body.style.overflow = viewingDoc ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [viewingDoc])

  const submit = async (files, assistance) => {
    if (await onAdd(files, assistance)) setAdding(false)
  }

  const travellerSummary = (p) => {
    const have = DOCS.filter((d) => p.documents[d]).map((d) => t(d)).join(', ')
    return `${p.name}. ${have}.` + (p.assistance !== 'none' ? ` ${t('assist_' + p.assistance)}.` : '')
  }

  return (
    <>
      <div className="gh"><h2>{t('travellers_title')}</h2><Listen text={`${t('travellers_title')}. ${t('travellers_hint')}`} toast={toast} /></div>
      <p className="muted">{t('travellers_hint')}</p>
      <TripCard summary={trip.summary} />
      {trip.travellers.length > 0 && (
        <div className="pax">
          {trip.travellers.map((p) => (
            <div className="p" key={p.id}>
              <div className="av">{p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)}</div>
              <div>
                <b>{p.name}</b>
                <small>{t('passport')} {p.documents.passport?.number || '—'}</small>
                <div className="docrows">
                  {DOCS.map((d) => (
                    <DocRow key={d} trip={trip} p={p} d={d} replacing={replacing} onView={view} onReplace={replace} busy={busy} />
                  ))}
                </div>
                {p.assistance !== 'none' && <div className="tags"><span className="tag">{t('assist_' + p.assistance)}</span></div>}
              </div>
              <span className="pax-actions">
                <Listen text={() => travellerSummary(p)} toast={toast} />
                <button type="button" className="iconbtn bad" aria-label={`${t('remove')} ${p.name}`} onClick={() => onRemove(p.id)} disabled={busy}>
                  <TrashIcon />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {error && <div className="err" role="alert">{error}</div>}
      {showForm
        ? <AddTravellerForm busy={busy} onSubmit={submit} onCancel={() => setAdding(false)} canCancel={trip.travellers.length > 0} />
        : <button className="btn ghost" onClick={() => setAdding(true)} disabled={busy}>+ {t('add_another')}</button>}
      {trip.travellers.length > 0 && !showForm && (
        <button className="btn pri full" onClick={onNext}>{t('continue')} →</button>
      )}
      {viewingDoc && (
        <div className="modal-overlay" onClick={() => {
          if (viewingDoc?.url) URL.revokeObjectURL(viewingDoc.url)
          setViewingDoc(null)
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <b>{viewingDoc.name}</b>
              <button className="modal-close" onClick={() => {
                if (viewingDoc?.url) URL.revokeObjectURL(viewingDoc.url)
                setViewingDoc(null)
              }}>&times;</button>
            </div>
            <div className="modal-body" style={{ position: 'relative' }}>
              {docLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <span className="spin" aria-hidden="true" style={{ width: 40, height: 40, borderWidth: 4 }}></span>
                </div>
              )}
              {viewingDoc.url && (
                <iframe
                  src={viewingDoc.url}
                  title={viewingDoc.name}
                  onLoad={() => setDocLoading(false)}
                  style={{ opacity: docLoading ? 0 : 1, transition: 'opacity 0.2s' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
