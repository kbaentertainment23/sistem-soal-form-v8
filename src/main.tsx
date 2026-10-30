import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Automatically register and update PWA Service Worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('Versi baru aplikasi tersedia.');
    },
    onOfflineReady() {
      console.log('Aplikasi siap digunakan dalam mode offline.');
    },
  });
}

// Handle benign Vite HMR websocket disconnects & Firestore warnings in sandbox preview environment
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : (a?.message ? a.message : String(a)))).join(' ');
    if (
      text.includes('@firebase/firestore') ||
      text.includes("Database '(default)' not found") ||
      text.includes('Firestore cloud sync fallback') ||
      text.includes('Could not sync') ||
      text.includes('client is offline') ||
      text.includes('Failed to get document because the client is offline') ||
      text.includes('Notice: Firestore')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  const originalError = console.error;
  console.error = (...args: any[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : (a?.message ? a.message : String(a)))).join(' ');
    if (
      text.includes('[vite] failed to connect to websocket') ||
      (text.includes('WebSocket') && (text.includes('closed') || text.includes('failed')))
    ) {
      return;
    }
    originalError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason || '');
    if (
      reasonStr.toLowerCase().includes('websocket') ||
      reasonStr.includes('WebSocket closed without opened')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = String(event.message || '');
    if (
      msg.toLowerCase().includes('websocket') ||
      msg.includes('WebSocket closed without opened')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

