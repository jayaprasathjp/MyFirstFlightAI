import { useI18n } from '../i18n'
import Listen from '../components/Listen'

const MARK = { pass: '✓', info: 'i', warn: '!', fail: '✕' }

function Check({ c }) {
  return (
    <div className={'check ' + c.status}>
      <span className="dot" aria-hidden="true">{MARK[c.status]}</span>
      <div><b>{c.title}</b><p>{c.message}</p></div>
    </div>
  )
}

export default function CheckScreen({ trip, onBack, onNext, toast }) {
  const { t } = useI18n()
  const ready = trip.status === 'ready'
  const groups = trip.travellers.map((p) => ({ key: p.id, title: p.name, checks: trip.checks.filter((c) => c.traveller_id === p.id) }))
  const tripChecks = trip.checks.filter((c) => !c.traveller_id)
  if (tripChecks.length) groups.push({ key: 'trip', title: t('trip_notes'), checks: tripChecks })

  const readAll = () => [ready ? t('ready_title') : t('fix_title'), ready ? t('ready_body') : t('fix_body'),
    ...groups.flatMap((g) => [g.title, ...g.checks.map((c) => `${c.title}. ${c.message}`)])].join('. ')

  return (
    <>
      <div className="gh"><h2>{t('check_title')}</h2><Listen text={readAll} toast={toast} /></div>
      <div className={'verdict ' + (ready ? 'ok' : 'warn')} role="status">
        <strong>{ready ? t('ready_title') + ' ✓' : t('fix_title')}</strong>
        <span>{ready ? t('ready_body') : t('fix_body')}</span>
      </div>
      {groups.map((g) => (
        <section className="group" key={g.key}>
          <h3>{g.title}</h3>
          {g.checks.map((c) => <Check key={c.id} c={c} />)}
        </section>
      ))}
      <div className="nav2">
        <button className="btn sec" onClick={onBack}>{t('back')}</button>
        <button className="btn pri" onClick={onNext}>{t('go_contacts')} →</button>
      </div>
    </>
  )
}
