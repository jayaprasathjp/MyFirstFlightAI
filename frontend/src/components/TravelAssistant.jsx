import { useEffect, useRef, useState } from 'react'

export default function TravelAssistant({ apiBaseUrl, user, language, text }) {
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState('')
  const [englishReply, setEnglishReply] = useState('')
  const [conversation, setConversation] = useState([])
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [asking, setAsking] = useState(false)
  const [status, setStatus] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const recordTimerRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => () => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    audioRef.current?.pause()
  }, [])

  const startRecording = async () => {
    setStatus('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus(text.speechUnavailable)
      return
    }
    const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) {
      setStatus(text.speechUnavailable)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks = []
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = async () => {
        setRecording(false)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        const audio = new Blob(chunks, { type: recorder.mimeType })
        if (!audio.size) return
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('file', audio, recorder.mimeType.startsWith('audio/ogg') ? 'question.ogg' : 'question.webm')
          form.append('language_code', language)
          const token = await user.getIdToken()
          const response = await fetch(`${apiBaseUrl}/api/speech-to-text`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
          const result = await response.json()
          if (!response.ok) throw new Error(text.askFailed)
          if (!result.transcript) throw new Error(text.noTranscript)
          setQuestion(result.transcript)
        } catch (error) {
          setStatus(error.message || text.askFailed)
        } finally {
          setTranscribing(false)
        }
      }
      recorder.start()
      setRecording(true)
      recordTimerRef.current = setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, 20000)
    } catch {
      setStatus(text.micPermission)
    }
  }

  const stopRecording = () => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const ask = async (event) => {
    event.preventDefault()
    if (!question.trim() || asking) return
    setAsking(true)
    setStatus('')
    setEnglishReply('')
    const nextConversation = [...conversation, { role: 'user', content: question.trim() }]
    try {
      const token = await user.getIdToken()
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question.trim(), history: conversation.slice(-6), language }),
      })
      const result = await response.json()
      if (!response.ok || !result.reply) throw new Error(text.askFailed)
      setReply(result.reply)
      setConversation([...nextConversation, { role: 'model', content: result.reply }])
      if (language !== 'en') {
        const translationResponse = await fetch(`${apiBaseUrl}/api/translate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_language: language, target_language: 'en', texts: [result.reply] }),
        })
        const translation = await translationResponse.json()
        if (translationResponse.ok) setEnglishReply(translation.translations?.[0] || '')
      } else {
        setEnglishReply(result.reply)
      }
      setQuestion('')
    } catch (error) {
      setStatus(error.message || text.askFailed)
    } finally {
      setAsking(false)
    }
  }

  const readAnswer = async () => {
    if (!reply) return
    setStatus('')
    try {
      const token = await user.getIdToken()
      const response = await fetch(`${apiBaseUrl}/api/text-to-speech`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply, language }),
      })
      if (!response.ok) throw new Error(text.speakFailed)
      const audioUrl = URL.createObjectURL(await response.blob())
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => URL.revokeObjectURL(audioUrl)
      await audio.play()
    } catch {
      setStatus(text.speakFailed)
    }
  }

  return (
    <section className="section-card assistant-card" lang={language}>
      <div className="section-heading"><div><h2>{text.assistantTitle}</h2><p>{text.assistantHelp}</p></div><span className="heading-icon">?</span></div>
      <form className="assistant-form" onSubmit={ask}>
        <label className="field-label"><span>{text.askPlaceholder}</span><textarea className="text-field assistant-input" rows="3" value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
        <div className="assistant-actions"><button type="button" className="btn sec" onClick={recording ? stopRecording : startRecording} disabled={transcribing || asking}>{recording ? text.micStop : transcribing ? text.transcribing : text.micStart}</button><button type="submit" className="btn pri" disabled={!question.trim() || asking || recording}>{asking ? text.thinking : text.askSend}</button></div>
      </form>
      {status && <p className="upload-error" role="status">{status}</p>}
      {reply && <div className="assistant-reply"><h3>{text.replyTitle}</h3><div><b>{text.localAnswer}</b><p lang={language}>{reply}</p></div>{englishReply && <div><b>{text.englishAnswer}</b><p lang="en">{englishReply}</p></div>}<button type="button" className="btn sec" onClick={readAnswer}>{text.readAnswer}</button></div>}
    </section>
  )
}