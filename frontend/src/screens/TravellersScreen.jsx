import { useState, useEffect } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'

const DOCS = ['ticket', 'passport', 'visa']
const ASSIST = ['none', 'elderly', 'wheelchair', 'visually_impaired']

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
            <span className="docicon" aria-hidden="true">{files[d] ? '✓' : '+'}</span>
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

export default function TravellersScreen({ trip, onAdd, onRemove, onReplaceDoc, onNext, busy, error }) {
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

  useEffect(() => {
    if (viewingDoc) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [viewingDoc])

  const submit = async (files, assistance) => {
    if (await onAdd(files, assistance)) setAdding(false)
  }
  return (
    <>
      <h2>{t('travellers_title')}</h2>
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
                <div className="docs-links" style={{marginTop: '4px', display: 'flex', gap: '8px', fontSize: '12px', flexWrap: 'wrap', alignItems: 'center'}}>
                  {DOCS.map((d) => (
                    p.documents[d] ? (
                      <span key={d} style={{display: 'inline-flex', gap: '6px', alignItems: 'center'}}>
                        <button className="link" type="button" style={{padding: 0, color: '#1a73e8', textDecoration: 'underline'}} onClick={() => {
                          setViewingDoc({ url: api.getFileUrl(trip.id, p.id, d), name: `${p.name} - ${t(d)}` })
                          setDocLoading(true)
                        }}>
                          {t('view')} {t(d)}
                        </button>
                        <label className="link filebtn" style={{padding: 0, textDecoration: 'underline', opacity: replacing === `${p.id}:${d}` ? 0.6 : 1}}>
                          {replacing === `${p.id}:${d}` ? t('replacing') : t('replace')}
                          <input type="file" accept="image/*,application/pdf" disabled={busy || !!replacing}
                            onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; replace(p.id, d, f) }} />
                        </label>
                      </span>
                    ) : null
                  ))}
                </div>
                {p.assistance !== 'none' && <div className="tags"><span className="tag">{t('assist_' + p.assistance)}</span></div>}
              </div>
              <button className="link" onClick={() => onRemove(p.id)} disabled={busy}>{t('remove')}</button>
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
        <div className="modal-overlay" onClick={() => setViewingDoc(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <b>{viewingDoc.name}</b>
              <button className="modal-close" onClick={() => setViewingDoc(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ position: 'relative' }}>
              {docLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <span className="spin" aria-hidden="true" style={{ width: 40, height: 40, borderWidth: 4 }}></span>
                </div>
              )}
              <iframe 
                src={viewingDoc.url} 
                title={viewingDoc.name} 
                onLoad={() => setDocLoading(false)}
                style={{ opacity: docLoading ? 0 : 1, transition: 'opacity 0.2s' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
