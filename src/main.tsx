import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { applyTheme } from './stores/themeStore'
import { initSecurityGuard } from './utils/securityGuard'

// Apply saved theme before first render to avoid flash of wrong theme
applyTheme(localStorage.getItem('bratnava-theme') === 'dark' ? 'dark' : 'light');

initSecurityGuard();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <HashRouter>
            <App />
        </HashRouter>
    </React.StrictMode>
)