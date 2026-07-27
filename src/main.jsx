import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import Toaster from './components/Toaster'
import KniffelCelebration from './components/KniffelCelebration'
import UpdatePrompt from './components/UpdatePrompt'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
      {/* Immer gemountet, damit der Speicher-Toast jede Screen-Navigation überlebt */}
      <Toaster />
      {/* Ebenso die Kniffel-Feier — sie wird aus jedem Spielmodus abgefeuert */}
      <KniffelCelebration />
      {/* Registriert den Service Worker und meldet neue Builds */}
      <UpdatePrompt />
    </AuthProvider>
  </StrictMode>
)
