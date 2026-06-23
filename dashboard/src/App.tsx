import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/login'
import Desktop from './pages/desktop'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/terminal" element={<ProtectedRoute><Desktop /></ProtectedRoute>} />
        <Route path="/metrics" element={<ProtectedRoute><Desktop /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Desktop /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

