import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/login'
import TerminalComponent from './pages/terminal'
import Metrics from './pages/metrics'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/terminal" element={<ProtectedRoute><TerminalComponent /></ProtectedRoute>} />
        <Route path="/metrics" element={<ProtectedRoute><Metrics /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Metrics /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

