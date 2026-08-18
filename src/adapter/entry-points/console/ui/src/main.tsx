import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConsolePage } from '@/features/console/pages/ConsolePage';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((e: unknown) => {
    console.warn('Service worker registration failed:', e);
  });
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(
  <StrictMode>
    <ConsolePage />
  </StrictMode>,
);
