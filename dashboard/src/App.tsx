import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/login'
import TerminalComponent from './pages/terminal'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/terminal" element={<TerminalComponent />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
