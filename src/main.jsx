import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import Toaster from './components/Toaster'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
      {/* Immer gemountet, damit der Speicher-Toast jede Screen-Navigation überlebt */}
      <Toaster />
    </AuthProvider>
  </StrictMode>
)
