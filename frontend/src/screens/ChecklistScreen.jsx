import { useEffect } from 'react'
import { useI18n } from '../i18n'
import { stopSpeaking } from '../voice'
import Listen from '../components/Listen'

const GROUPS = ['t3', 't1', 't0']

export default function ChecklistScreen({ checklist, done, onToggle, toast }) {
  const { t, fmtDate } = useI18n()
  const items = checklist.items
  // Progress counts required items only; optional ones can still be ticked.
  const required = items.filter((i) => !i.optional)
  const count = required.filter((i) => done[i.id]).length
  const pct = required.length ? Math.round((count / required.length) * 100) : 0

  useEffect(() => stopSpeaking, []) // stop reading if the traveller navigates away mid-playback

  return (
    <>
      <div className="gh"><h2>{t('checklist_title')}</h2><Listen text={t('checklist_title')} toast={toast} /></div>
      <div className="prog">
        <div className="gh"><span><b>{count} / {required.length}</b> {t('done')}</span><span>{pct}%</span></div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }}></i></div>
        <small className="muted">{t('checklist_saved')}</small>
      </div>
      {GROUPS.map((g) => {
        const list = items.filter((i) => i.group === g)
        if (!list.length) return null
        const req = list.filter((i) => !i.optional)
        return (
          <section className="group" key={g}>
            <div className="gh">
              <h3>{t(g)}{checklist.dates[g] && <> · {fmtDate(checklist.dates[g], { weekday: 'short', day: 'numeric', month: 'short' })}</>}</h3>
              <span>{req.filter((i) => done[i.id]).length}/{req.length}</span>
            </div>
            {list.map((i) => (
              <label key={i.id} className={['item', done[i.id] && 'done', i.key && !done[i.id] && 'key', i.optional && 'optional'].filter(Boolean).join(' ')}>
                <input type="checkbox" checked={!!done[i.id]} onChange={() => onToggle(i.id)} />
                <div>
                  {i.optional && <span className="opttag">{t('optional')}</span>}
                  <b>{i.title}</b><small>{i.detail}</small>
                  {i.link && (
                    <a className="official" href={i.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {t('official_site')} ↗
                    </a>
                  )}
                  {i.ai && <span className="aibadge">✦ {t('ai_badge')}</span>}
                </div>
                <Listen text={`${i.title}. ${i.detail}${i.optional ? `. ${t('optional')}` : ''}`} toast={toast} />
              </label>
            ))}
          </section>
        )
      })}
    </>
  )
}
