import React from 'react';
import { createRoot } from 'react-dom/client';
import '../i18n';
import WarningPage from './WarningPage';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WarningPage />
  </React.StrictMode>,
);
