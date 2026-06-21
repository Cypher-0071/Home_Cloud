import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Wraps any page that requires authentication.
 * 
 * How it works:
 * 1. On mount, makes a GET request to /api/health (which sits behind the auth middleware)
 * 2. If the server returns 200 → the cookie is valid → render the children
 * 3. If the server returns 401 → not logged in → redirect to /login
 * 
 * This runs BEFORE the page component mounts, so things like WebSocket
 * connections in <TerminalComponent> won't even attempt to connect
 * unless the user is authenticated.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null) // null = still checking

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (res.ok) {
          setIsAuthed(true)
        } else {
          navigate('/login', { replace: true })
        }
      })
      .catch(() => {
        // Network error (server down, etc.) — send to login as a safe default
        navigate('/login', { replace: true })
      })
  }, [navigate])

  // While the check is in-flight, show nothing (or you could show a spinner)
  if (isAuthed === null) {
    return null
  }

  return <>{children}</>
}
