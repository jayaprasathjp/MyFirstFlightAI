const BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

let authToken = null;

// retry: repeat once after a connection failure (only for requests that are safe to repeat).
async function request(path, options = {}, retry = false) {
  let res
  try {
    const headers = options.headers || {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    options.headers = headers;
    res = await fetch(`${BASE}${path}`, options)
  } catch {
    if (retry) {
      await new Promise((r) => setTimeout(r, 1500))
      return request(path, options, false)
    }
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
  setToken: (token) => { authToken = token; },
  createTrip: (language) => request('/api/trips', json('POST', { language })),
  getTrips: () => request('/api/trips'),
  getTrip: (id) => request(`/api/trips/${id}`),
  setLanguage: (id, language) => request(`/api/trips/${id}`, json('PATCH', { language })),
  addTraveller: (id, files, assistance) => {
    const form = new FormData()
    for (const [k, f] of Object.entries(files)) form.append(k, f)
    form.append('assistance', assistance)
    return request(`/api/trips/${id}/travellers`, { method: 'POST', body: form })
  },
  removeTraveller: (id, travellerId) => request(`/api/trips/${id}/travellers/${travellerId}`, { method: 'DELETE' }),
  replaceDocument: (id, travellerId, doc, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/api/trips/${id}/travellers/${travellerId}/documents/${doc}`, { method: 'PUT', body: form })
  },
  saveChecklist: (id, done) => request(`/api/trips/${id}/checklist`, json('PUT', { done })),
  deleteTrip: (id) => request(`/api/trips/${id}`, { method: 'DELETE' }),
  saveQuickAnswers: (id, answers) => request(`/api/trips/${id}/quick-answers`, json('PUT', { answers })),
  saveContacts: (id, contacts) => request(`/api/trips/${id}/contacts`, json('PUT', { contacts })),
  saveBoarding: (id, gate, boarding_time) => request(`/api/trips/${id}/boarding`, json('PUT', { gate, boarding_time })),
  ask: (id, { text, audio }) => request(`/api/trips/${id}/ask`, { method: 'POST', body: voiceForm(text, audio) }, true),
  toEnglish: (id, { text, audio }) => request(`/api/trips/${id}/to-english`, { method: 'POST', body: voiceForm(text, audio) }, true),
  boardingPass: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/api/trips/${id}/boarding-pass`, { method: 'POST', body: form })
  },
  assist: (id, body) => request(`/api/trips/${id}/assist`, json('POST', body)),
  tts: (text, language) => request('/api/tts', json('POST', { text, language }), true),
  translate: (language, texts) => request('/api/translate', json('POST', { language, texts })),
  getFileUrl: async (tripId, travellerId, doc) => {
    let res;
    try {
      const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
      res = await fetch(`${BASE}/api/trips/${tripId}/travellers/${travellerId}/documents/${doc}`, { headers });
    } catch {
      throw new Error('network');
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
}

// User-facing text for an API error ('network' = the server could not be reached).
export const errorText = (e, t) => (e.message === 'network' ? t('err_network') : e.message)

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k) } catch { /* storage unavailable */ } },
}
