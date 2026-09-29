import { useEffect, useState } from 'react'

export default function EmergencyContact({ apiBaseUrl, user, text, language }) {
  const [contact, setContact] = useState({ name: '', phone: '', relationship: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let active = true
    user.getIdToken().then((token) => fetch(`${apiBaseUrl}/api/emergency-contact`, { headers: { Authorization: `Bearer ${token}` } })).then(async (response) => {
      if (!response.ok) throw new Error()
      const saved = await response.json()
      if (active) setContact({ name: saved.name || '', phone: saved.phone || '', relationship: saved.relationship || '' })
    }).catch(() => { if (active) setStatus(text.contactError) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [apiBaseUrl, user])

  const saveContact = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus('')
    try {
      const token = await user.getIdToken()
      const response = await fetch(`${apiBaseUrl}/api/emergency-contact`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      })
      if (!response.ok) throw new Error()
      setStatus(text.contactSaved)
    } catch {
      setStatus(text.contactError)
    } finally {
      setSaving(false)
    }
  }

  const clearContact = async () => {
    setSaving(true)
    setStatus('')
    try {
      const token = await user.getIdToken()
      const response = await fetch(`${apiBaseUrl}/api/emergency-contact`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error()
      setContact({ name: '', phone: '', relationship: '' })
      setStatus(text.contactCleared)
    } catch {
      setStatus(text.contactError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="section-card emergency-card" lang={language}>
      <div className="section-heading"><div><h2>{text.emergencyTitle}</h2><p>{text.emergencyHelp}</p></div><span className="heading-icon">!</span></div>
      <form className="emergency-form" onSubmit={saveContact}>
        <label className="field-label">{text.emergencyName}<input className="text-field" autoComplete="name" required maxLength="100" value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} /></label>
        <label className="field-label">{text.emergencyPhone}<input className="text-field" type="tel" autoComplete="tel" inputMode="tel" required minLength="7" maxLength="24" placeholder="+91 98765 43210" value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} /></label>
        <label className="field-label">{text.emergencyRelation}<input className="text-field" autoComplete="off" maxLength="80" value={contact.relationship} onChange={(event) => setContact((current) => ({ ...current, relationship: event.target.value }))} /></label>
        <div className="emergency-actions"><button className="review-button" type="submit" disabled={loading || saving}>{saving ? text.saving : text.saveContact}</button><button type="button" className="remove-button" disabled={loading || saving || !contact.phone} onClick={clearContact}>{text.clearContact}</button><span role="status">{status}</span></div>
      </form>
    </section>
  )
}