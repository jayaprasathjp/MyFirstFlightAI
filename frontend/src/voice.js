import { useRef, useState } from 'react'
import { api } from './api'
import { LANGUAGES } from './strings'

const MAX_RECORDING_MS = 30000

// Microphone recording with MediaRecorder. start() asks for permission; stop() resolves with the audio Blob.
export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const rec = useRef(null)

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((m) => window.MediaRecorder?.isTypeSupported?.(m))
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise((resolve) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        resolve(new Blob(chunks, { type: (recorder.mimeType || 'audio/webm').split(';')[0] }))
      }
    })
    recorder.start()
    const timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), MAX_RECORDING_MS)
    rec.current = { recorder, done, timer }
    setRecording(true)
  }

  const stop = async () => {
    const r = rec.current
    if (!r) return null
    clearTimeout(r.timer)
    if (r.recorder.state === 'recording') r.recorder.stop()
    rec.current = null
    setRecording(false)
    return r.done
  }

  return { recording, start, stop }
}

let current = null
let generation = 0 // bumped by stopSpeaking, so audio that arrives after a stop is never played
let activeKey = null // which Listen button (if any) is playing right now
const subs = new Set()
const setActive = (k) => { activeKey = k; subs.forEach((f) => f()) }
export const subscribeSpeaking = (f) => { subs.add(f); return () => subs.delete(f) }
export const getSpeakingKey = () => activeKey

export function stopSpeaking() {
  generation++
  try { current?.pause() } catch { /* nothing playing */ }
  current = null
  try { speechSynthesis.cancel() } catch { /* not supported */ }
  setActive(null)
}

export function pauseSpeaking() {
  try { current?.pause() } catch { /* nothing playing */ }
  try { speechSynthesis.pause() } catch { /* not supported */ }
}

export function resumeSpeaking() {
  try { if (current?.paused && !current.ended) current.play() } catch { /* nothing to resume */ }
  try { speechSynthesis.resume() } catch { /* not supported */ }
}

// Starts speaking; resolves with a promise that settles when the speech ends, or null if nothing can speak.
async function start(text, lang, key = null) {
  stopSpeaking()
  const gen = generation
  const done = () => { if (gen === generation) setActive(null) }
  try {
    const r = await api.tts(text, lang)
    if (gen !== generation) return null
    const audio = new Audio(`data:${r.mime};base64,${r.audio}`)
    current = audio
    const ended = new Promise((resolve) => {
      audio.onended = () => { done(); resolve() }
      audio.onerror = () => { done(); resolve() }
    })
    await audio.play()
    setActive(key)
    return ended
  } catch {
    if (gen !== generation) return null
    const locale = (LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]).locale
    const voices = window.speechSynthesis?.getVoices() || []
    const voice = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === locale.toLowerCase())
      || voices.find((v) => v.lang.toLowerCase().startsWith(lang))
    if (!voice) return null
    const u = new SpeechSynthesisUtterance(text)
    u.voice = voice
    u.lang = voice.lang
    u.rate = 0.9
    const ended = new Promise((resolve) => {
      u.onend = () => { done(); resolve() }
      u.onerror = () => { done(); resolve() }
    })
    speechSynthesis.speak(u)
    setActive(key)
    return ended
  }
}

// Speak text in the app language: Cloud Text-to-Speech first, then the phone's own voice. Returns false if neither works.
// `key` (optional) identifies the caller so its button can show a "playing" state until the audio ends.
export async function speak(text, lang, key = null) {
  return (await start(text, lang, key)) !== null
}

// Like speak(), but resolves only when the speech has finished (false right away if nothing can speak).
export async function speakToEnd(text, lang, key = null) {
  const ended = await start(text, lang, key)
  if (!ended) return false
  await ended
  return true
}
