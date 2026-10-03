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

// Yes/no questions after upload: "yes, already done" removes that task from the checklist.
function QuickQuestions({ questions, onAnswer, busy }) {
  const { t } = useI18n()
  if (!questions?.length) return null
  return (
    <section className="card form quickq">
      <h3>{t('quick_title')}</h3>
      {questions.map((q) => (
        <div key={q.id} className="qrow">
          <b>{q.question}</b>
          <div className="row2 even">
            <button className={'btn sec' + (q.answer === true ? ' chosen' : '')} disabled={busy}
              aria-pressed={q.answer === true} onClick={() => onAnswer(q.id, true)}>✓ {t('yes_done')}</button>
            <button className={'btn sec' + (q.answer === false ? ' chosen' : '')} disabled={busy}
              aria-pressed={q.answer === false} onClick={() => onAnswer(q.id, false)}>{t('not_yet')}</button>
          </div>
        </div>
      ))}
      <small className="muted">{t('quick_hint')}</small>
    </section>
  )
}

export default function CheckScreen({ trip, onBack, onNext, onAnswer, busy, toast }) {
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
      <QuickQuestions questions={trip.quick_questions} onAnswer={onAnswer} busy={busy} />
      <div className="nav2">
        <button className="btn sec" onClick={onBack}>{t('back')}</button>
        <button className="btn pri" onClick={onNext}>{t('go_contacts')} →</button>
      </div>
    </>
  )
}
