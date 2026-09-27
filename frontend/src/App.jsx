import Chatbot from './components/Chatbot'
import './App.css'

function App() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

  return (
    <div className="app-viewport">
      <Chatbot apiBaseUrl={API_BASE_URL} />
    </div>
  )
}

export default App
