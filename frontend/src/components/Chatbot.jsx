import { useState, useEffect, useRef } from 'react'
import { auth } from '../firebase'
import './Chatbot.css'

export default function Chatbot({ apiBaseUrl }) {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content: 'Hello! I am MyFirstFlight AI. How can I help you today?'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [online, setOnline] = useState(true)
  const messagesEndRef = useRef(null)

  const suggestions = [
    '✈️ Plan a 3-day trip to Tokyo',
    '💡 What can you help me with?',
    '☁️ How to deploy on Cloud Run?'
  ]

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/health`)
      .then((res) => res.json())
      .then((data) => setOnline(data && data.status === 'ok'))
      .catch(() => setOnline(false))
  }, [apiBaseUrl])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (textToSend) => {
    const prompt = textToSend || input
    if (!prompt.trim() || loading) return

    const userMessage = { role: 'user', content: prompt }
    setMessages((prev) => [...prev, userMessage])
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      const token = await auth?.currentUser?.getIdToken()
      if (!token) throw new Error('Sign in before using chat.')
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          history: messages.slice(-6)
        })
      })

      const data = await response.json()
      if (response.ok && data.reply) {
        setMessages((prev) => [...prev, { role: 'model', content: data.reply }])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'model', content: data.detail || data.reply || 'Sorry, something went wrong.' }
        ])
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: '⚠️ Server connection error. Please check backend.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-card">
      <header className="chat-card-header">
        <div className="header-title">
          <span className="logo-icon">✈️</span>
          <h1>MyFirstFlight AI</h1>
        </div>
        <div className="online-indicator">
          <span className={`dot ${online ? 'online' : 'offline'}`}></span>
          <span>{online ? 'Online' : 'Offline'}</span>
        </div>
      </header>

      <div className="chat-body">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-row ${msg.role === 'user' ? 'user' : 'model'}`}>
            <div className="chat-bubble">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="chat-row model">
            <div className="chat-bubble loading">
              <span className="dot-pulse"></span>
              <span className="dot-pulse"></span>
              <span className="dot-pulse"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 2 && (
        <div className="suggestions">
          {suggestions.map((text, idx) => (
            <button key={idx} className="chip" onClick={() => handleSend(text)}>
              {text}
            </button>
          ))}
        </div>
      )}

      <footer className="chat-card-footer">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask AI..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          Send
        </button>
      </footer>
    </div>
  )
}
