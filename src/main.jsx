import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
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
      {/* Gehört hierher und nicht in App.jsx: dort steht eine Kette früher
          Returns (Login, ProfileSetup, jeder Screen), die Komponente wäre je
          nach Zustand gar nicht gemountet. mode explizit, weil die
          Auto-Erkennung auf NODE_ENV baut — so loggt sie lokal in die Konsole
          und sendet nur im echten Build. */}
      <Analytics mode={import.meta.env.PROD ? 'production' : 'development'} />
    </AuthProvider>
  </StrictMode>
)
