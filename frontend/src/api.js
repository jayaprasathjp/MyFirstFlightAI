const BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, options)
  } catch {
    throw new Error('network')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function voiceForm(text, audio) {
  const form = new FormData()
  if (text) form.append('text', text)
  if (audio) form.append('audio', audio, 'question.' + (audio.type.includes('mp4') ? 'mp4' : audio.type.includes('ogg') ? 'ogg' : 'webm'))
  return form
}

export const api = {
  createTrip: (language) => request('/api/trips', json('POST', { language })),
  getTrip: (id) => request(`/api/trips/${id}`),
  setLanguage: (id, language) => request(`/api/trips/${id}`, json('PATCH', { language })),
  addTraveller: (id, files, assistance) => {
    const form = new FormData()
    for (const [k, f] of Object.entries(files)) form.append(k, f)
    form.append('assistance', assistance)
    return request(`/api/trips/${id}/travellers`, { method: 'POST', body: form })
  },
  removeTraveller: (id, travellerId) => request(`/api/trips/${id}/travellers/${travellerId}`, { method: 'DELETE' }),
  saveChecklist: (id, done) => request(`/api/trips/${id}/checklist`, json('PUT', { done })),
  saveContacts: (id, contacts) => request(`/api/trips/${id}/contacts`, json('PUT', { contacts })),
  saveBoarding: (id, gate, boarding_time) => request(`/api/trips/${id}/boarding`, json('PUT', { gate, boarding_time })),
  ask: (id, { text, audio }) => request(`/api/trips/${id}/ask`, { method: 'POST', body: voiceForm(text, audio) }),
  toEnglish: (id, { text, audio }) => request(`/api/trips/${id}/to-english`, { method: 'POST', body: voiceForm(text, audio) }),
  boardingPass: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/api/trips/${id}/boarding-pass`, { method: 'POST', body: form })
  },
  assist: (id, body) => request(`/api/trips/${id}/assist`, json('POST', body)),
  tts: (text, language) => request('/api/tts', json('POST', { text, language })),
  translate: (language, texts) => request('/api/translate', json('POST', { language, texts })),
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k) } catch { /* storage unavailable */ } },
}
