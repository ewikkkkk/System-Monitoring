import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SystemMonitoringPage from './SystemMonitoringPage.jsx';
function LocalPreview() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('sysmon-theme') !== 'light'; }
    catch { return true; }
  });
  function toggleDarkMode() {
    setDarkMode(current => {
      const next = !current;
      try { localStorage.setItem('sysmon-theme', next ? 'dark' : 'light'); }
      catch { /* Theme switching remains available when browser storage is disabled. */ }
      return next;
    });
  }
  return <SystemMonitoringPage darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />;
}
createRoot(document.getElementById('root')).render(<LocalPreview />);
