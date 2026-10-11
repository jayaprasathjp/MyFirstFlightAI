import { useState } from 'react'
import { useI18n } from '../i18n'
import Listen from './Listen'

const FACES = ['😞', '🙁', '😐', '🙂', '🤩'] // rating 1..5
const PARTS = ['documents', 'checklist', 'airport_steps', 'help', 'lost', 'walkthrough', 'voice']

// After the trip: a face rating, what helped, and an optional comment. Saved with onSave({rating, helped, comment}).
export default function FeedbackForm({ feedback, onSave, busy, toast }) {
  const { t } = useI18n()
  const [rating, setRating] = useState(feedback?.rating || 0)
  const [helped, setHelped] = useState(feedback?.helped || [])
  const [comment, setComment] = useState(feedback?.comment || '')
  const [sent, setSent] = useState(!!feedback)
  const [err, setErr] = useState('')
  const toggle = (p) => { setHelped((h) => (h.includes(p) ? h.filter((x) => x !== p) : [...h, p])); setSent(false) }
  const send = async () => {
    if (!rating) return setErr(t('fb_need_rating'))
    setErr('')
    if (await onSave({ rating, helped, comment: comment.trim() })) setSent(true)
  }
  const spoken = () => [t('fb_title'), t('fb_hint'), FACES.map((_, i) => t(`fb_r${i + 1}`)).join(', '), t('fb_helped')].join('. ')

  return (
    <section className="feedback" aria-label={t('fb_title')}>
      <div className="gh"><h3>{t('fb_title')}</h3><Listen text={spoken} toast={toast} /></div>
      <span className="muted">{t('fb_hint')}</span>
      <div className="faces" role="radiogroup" aria-label={t('fb_title')}>
        {FACES.map((f, i) => (
          <button key={f} type="button" role="radio" aria-checked={rating === i + 1} className={rating === i + 1 ? 'on' : ''}
            onClick={() => { setRating(i + 1); setSent(false); setErr('') }}>
            <span aria-hidden="true">{f}</span><small>{t(`fb_r${i + 1}`)}</small>
          </button>
        ))}
      </div>
      <b>{t('fb_helped')}</b>
      <div className="chips">
        {PARTS.map((p) => (
          <button key={p} type="button" aria-pressed={helped.includes(p)} className={'btn sec' + (helped.includes(p) ? ' chosen' : '')}
            onClick={() => toggle(p)}>{helped.includes(p) ? '✓ ' : ''}{t(`fb_p_${p}`)}</button>
        ))}
      </div>
      <label>{t('fb_comment')}
        <textarea rows={3} maxLength={1000} value={comment} placeholder={t('fb_comment_ph')}
          onChange={(e) => { setComment(e.target.value); setSent(false) }} />
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      {sent
        ? <div className="fb-thanks" role="status">✓ {t('fb_thanks')}</div>
        : <button className="btn pri full" onClick={send} disabled={busy}>{feedback ? t('fb_update') : t('fb_send')}</button>}
    </section>
  )
}
