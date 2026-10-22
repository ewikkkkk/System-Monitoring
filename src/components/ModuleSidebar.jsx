import React from 'react';
import { Activity, LayoutDashboard, List, CalendarDays, Plus, Moon, Sun } from 'lucide-react';

const views = [['overview', 'Overview', LayoutDashboard], ['list', 'List', List], ['calendar', 'Calendar', CalendarDays]];

// Module navigation requested for local use; the host can move this into its sidebar.
export default function ModuleSidebar({ view, taskOpen, taskCount, onNavigate, onCreate, disabled, darkMode, onToggleDarkMode }) {
  return <aside className="sysmon-sidebar" aria-label="System monitoring navigation">
    <div className="sysmon-sidebar-brand"><span className="sysmon-brand-icon"><Activity size={18} /></span><span>System monitoring<span className="sysmon-sidebar-caption">Enhancements & bugs</span></span></div>
    <div className="sysmon-sidebar-label">WORKSPACE</div>
    <nav className="sysmon-sidebar-nav" aria-label="Task views">{views.map(([key, label, Icon]) =>
      <button key={key} className={`sysmon-sidebar-link ${view === key && !taskOpen ? 'sysmon-sidebar-link-active' : ''}`}
        aria-current={view === key && !taskOpen ? 'page' : undefined} onClick={() => onNavigate(key)}>
        <Icon size={17} /><span>{label}</span>{key === 'list' && <span className="sysmon-count">{taskCount}</span>}
      </button>
    )}</nav>
    <button className="sysmon-button sysmon-sidebar-create" onClick={onCreate} disabled={disabled}><Plus size={16} /> New task</button>
    <button className="sysmon-theme-toggle" role="switch" aria-label="Dark mode" aria-checked={darkMode} onClick={onToggleDarkMode}>
      {darkMode ? <Moon size={16} /> : <Sun size={16} />}<span>Dark mode</span><span className={`sysmon-switch-track ${darkMode ? 'sysmon-switch-on' : ''}`}><span className="sysmon-switch-thumb" /></span>
    </button>
    <p className="sysmon-sidebar-note">Track the work.<br />Keep the team connected.</p>
  </aside>;
}
