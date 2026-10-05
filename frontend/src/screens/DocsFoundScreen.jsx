import { useI18n } from '../i18n'

const DOCS = ['ticket', 'passport', 'visa']

// Shown when a signed-in user opens a trip whose documents are already saved:
// continue with them, or go to the Travellers screen to replace any of them.
export default function DocsFoundScreen({ trip, onContinue, onReplace }) {
  const { t, fmtDate } = useI18n()
  const s = trip.summary
  return (
    <>
      <h2>{t('docs_found_title')}</h2>
      <p className="muted">{t('docs_found_hint')}</p>
      {s && (
        <div className="card">
          <b>✈ {s.origin_city || s.origin_code} → {s.destination_city || s.destination_code}</b>
          <div className="muted small">{(s.flights || []).join(' + ')}{s.departure_date && ` · ${fmtDate(s.departure_date)}`}</div>
        </div>
      )}
      <div className="pax">
        {trip.travellers.map((p) => (
          <div className="card docsfound" key={p.id}>
            <b>{p.name}</b>
            <div className="tags">
              {DOCS.map((d) => (
                <span key={d} className={'tag' + (p.documents?.[d] ? ' ok' : '')}>{p.documents?.[d] ? '✓' : '✕'} {t(d)}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="docs-actions">
        <button className="btn pri full" onClick={onContinue}>{t('continue_docs')} →</button>
        <button className="btn sec full" onClick={onReplace}>{t('replace_docs')}</button>
      </div>
    </>
  )
}
