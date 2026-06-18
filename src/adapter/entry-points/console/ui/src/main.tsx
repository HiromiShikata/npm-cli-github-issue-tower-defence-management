import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConsolePage } from '@/features/console/pages/ConsolePage';
import './index.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(
  <StrictMode>
    <ConsolePage />
  </StrictMode>,
);
