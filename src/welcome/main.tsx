import React from 'react';
import ReactDOM from 'react-dom/client';
import Welcome from './Welcome';
import '../i18n';
import '../styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Welcome />
  </React.StrictMode>
);
