import { useI18n } from '../i18n'

const GROUPS = ['t3', 't1', 't0']

export default function ChecklistScreen({ checklist, done, onToggle }) {
  const { t, fmtDate } = useI18n()
  const items = checklist.items
  const count = items.filter((i) => done[i.id]).length
  const pct = items.length ? Math.round((count / items.length) * 100) : 0

  return (
    <>
      <h2>{t('checklist_title')}</h2>
      <div className="prog">
        <div className="gh"><span><b>{count} / {items.length}</b> {t('done')}</span><span>{pct}%</span></div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }}></i></div>
        <small className="muted">{t('checklist_saved')}</small>
      </div>
      {GROUPS.map((g) => {
        const list = items.filter((i) => i.group === g)
        if (!list.length) return null
        return (
          <section className="group" key={g}>
            <div className="gh">
              <h3>{t(g)}{checklist.dates[g] && <> · {fmtDate(checklist.dates[g], { weekday: 'short', day: 'numeric', month: 'short' })}</>}</h3>
              <span>{list.filter((i) => done[i.id]).length}/{list.length}</span>
            </div>
            {list.map((i) => (
              <label key={i.id} className={['item', done[i.id] && 'done', i.key && !done[i.id] && 'key'].filter(Boolean).join(' ')}>
                <input type="checkbox" checked={!!done[i.id]} onChange={() => onToggle(i.id)} />
                <div><b>{i.title}</b><small>{i.detail}</small></div>
              </label>
            ))}
          </section>
        )
      })}
    </>
  )
}
