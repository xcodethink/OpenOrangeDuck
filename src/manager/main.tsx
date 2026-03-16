import React from 'react';
import ReactDOM from 'react-dom/client';
import Manager from './Manager';
import '../i18n';
import '../styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Manager />
  </React.StrictMode>
);
