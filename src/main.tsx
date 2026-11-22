import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './App.css'
import { applyTheme, buildTheme, ThemeMode } from './theme'

// Apply the saved theme before the first paint so the toolbar never flashes the default colours
try {
  const saved = JSON.parse(localStorage.getItem('malipen_settings') || '{}')
  const mode: ThemeMode = ['dark', 'light', 'colorful'].includes(saved.themeMode) ? saved.themeMode : 'dark'
  applyTheme(buildTheme({ themeMode: mode, themeAccent: saved.themeAccent }), mode)
} catch { /* defaults from App.css are used */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
