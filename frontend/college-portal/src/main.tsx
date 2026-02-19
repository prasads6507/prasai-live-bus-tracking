import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary';

// Global Error Logger for Mobile Debugging
window.onerror = function (message, source, lineno, colno, error) {
  console.error("Global error caught:", message, source, lineno, colno, error);
  // Optional: Send to logging service
  return false;
};

window.onunhandledrejection = function (event) {
  console.error("Unhandled promise rejection:", event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
