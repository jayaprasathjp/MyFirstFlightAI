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
let seq = 0 // every speak() call takes a number so a slow cloud-TTS reply never plays over a newer request
let activeKey = null // which Listen button (if any) is playing right now
const subs = new Set()
const setActive = (k) => { activeKey = k; subs.forEach((f) => f()) }
export const subscribeSpeaking = (f) => { subs.add(f); return () => subs.delete(f) }
export const getSpeakingKey = () => activeKey

export function stopSpeaking() {
  seq++
  try { current?.pause() } catch { /* nothing playing */ }
  try { speechSynthesis.cancel() } catch { /* not supported */ }
  setActive(null)
}

// Speak text in the app language: Cloud Text-to-Speech first, then the phone's own voice. Returns false if neither works.
// `key` (optional) identifies the caller so its button can show a "playing" state until the audio ends.
export async function speak(text, lang, key = null) {
  stopSpeaking()
  const mine = seq
  const done = () => { if (seq === mine) setActive(null) }
  try {
    const r = await api.tts(text, lang)
    if (seq !== mine) return true // a newer request took over
    current = new Audio(`data:${r.mime};base64,${r.audio}`)
    current.onended = done
    current.onerror = done
    await current.play()
    setActive(key)
    return true
  } catch {
    if (seq !== mine) return true
    const locale = (LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]).locale
    const voices = window.speechSynthesis?.getVoices() || []
    const voice = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === locale.toLowerCase())
      || voices.find((v) => v.lang.toLowerCase().startsWith(lang))
    if (!voice) return false
    const u = new SpeechSynthesisUtterance(text)
    u.voice = voice
    u.lang = voice.lang
    u.rate = 0.9
    u.onend = done
    u.onerror = done
    speechSynthesis.speak(u)
    setActive(key)
    return true
  }
}
