import React, { useEffect, useRef, useState } from 'react';
import { ListFilter, CircleCheck, Users, Search, X, Plus, RefreshCw, Check, ChevronDown } from 'lucide-react';
import { statuses } from '../task-utils.js';

export default function TaskToolbar({ view, count, people, search, setSearch, type, setType, priority, setPriority, person, setPerson, status, setStatus, onCreate, onRefresh, loading, unavailable }) {
  const [panel, setPanel] = useState(null), [searchOpen, setSearchOpen] = useState(false);
  const root = useRef(null), panelRef = useRef(null), searchRef = useRef(null);
  const triggers = useRef({});
  const selectedPerson = people.find(p => p.userId === person);
  const activeFilters = Number(!!type) + Number(!!priority);
  const availableStatuses = statuses;
  function closePanel(restoreFocus = false) {
    if (restoreFocus) triggers.current[panel]?.focus();
    setPanel(null);
  }
  useEffect(() => {
    if (!panel) return;
    panelRef.current?.querySelector('select, [role="menuitemradio"], button')?.focus();
    const outside = event => { if (!root.current?.contains(event.target)) setPanel(null); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [panel]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  function reset() { setSearch(''); setType(''); setPriority(''); setPerson(''); setStatus(''); }
  const hasFilters = search || type || priority || person || status;
  const trigger = (key, label, Icon, active) => <button ref={node => { triggers.current[key] = node; }}
    className={'sysmon-tool-pill' + (active ? ' sysmon-tool-active' : '')} aria-expanded={panel === key}
    aria-controls={'sysmon-popup-' + key} aria-haspopup={key === 'status' ? 'menu' : 'dialog'} onClick={() => setPanel(panel === key ? null : key)}>
    <Icon size={13} /><span>{label}</span>{key === 'filter' && activeFilters > 0 && <span className="sysmon-tool-count">{activeFilters}</span>}<ChevronDown size={11} />
  </button>;
  return <div ref={root} className="sysmon-task-tools" onKeyDown={event => {
    if (event.key === 'Escape' && panel) { event.preventDefault(); closePanel(true); }
  }}>
    <div className="sysmon-compact-toolbar"><h1 className="sysmon-view-label sysmon-module-title">{view === 'overview' ? 'Overview' : status || 'WMS Bugs and Enhancement'}<span className="sysmon-count">{count}</span></h1>
      <div className="sysmon-tool-actions">
        <div className="sysmon-tool-anchor">{trigger('filter', 'Filter', ListFilter, activeFilters > 0)}
          {panel === 'filter' && <div ref={panelRef} id="sysmon-popup-filter" role="dialog" aria-label="Filter tasks" className="sysmon-tool-popover">
            <div className="sysmon-popover-heading">Filter tasks<button className="sysmon-tool-icon" aria-label="Close filters" onClick={() => closePanel(true)}><X size={14} /></button></div>
            <label className="sysmon-field">Task type<select className="sysmon-input" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option><option>Bug</option><option>Enhancement</option></select></label>
            <label className="sysmon-field">Priority<select className="sysmon-input" value={priority} onChange={e => setPriority(e.target.value)}><option value="">All priorities</option>{['Urgent','High','Normal','Low'].map(p => <option key={p}>{p}</option>)}</select></label>
            <div className="sysmon-popover-footer"><button className="sysmon-tool-text" onClick={() => { setType(''); setPriority(''); }}>Reset</button><button className="sysmon-button" onClick={() => closePanel(true)}>Done</button></div>
          </div>}
        </div>
        <div className="sysmon-tool-anchor">{trigger('status', status || 'Status', CircleCheck, !!status)}
          {panel === 'status' && <div ref={panelRef} id="sysmon-popup-status" role="menu" aria-label="Task status" className="sysmon-tool-popover sysmon-status-menu" onKeyDown={event => {
            const items = [...event.currentTarget.querySelectorAll('[role="menuitemradio"]')];
            const index = items.indexOf(document.activeElement);
            const next = event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index + items.length - 1) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
            if (next !== null) { event.preventDefault(); items[next]?.focus(); }
          }}>{['', ...availableStatuses].map(s => <button key={s} role="menuitemradio" aria-checked={status === s} className="sysmon-status-option" onClick={() => { setStatus(s); closePanel(true); }}><span>{s || (view === 'list' ? 'All unfinished tasks' : 'All statuses')}</span>{status === s && <Check size={14} />}</button>)}</div>}
        </div>
        <div className="sysmon-tool-anchor">{trigger('assignee', selectedPerson?.displayName || 'Assignee', Users, !!person)}
          {panel === 'assignee' && <div ref={panelRef} id="sysmon-popup-assignee" role="dialog" aria-label="Filter by assignee" className="sysmon-tool-popover">
            <div className="sysmon-popover-heading">Assignee<button className="sysmon-tool-icon" aria-label="Close assignee filter" onClick={() => closePanel(true)}><X size={14} /></button></div>
            <label className="sysmon-field">Developer or tester<select className="sysmon-input" value={person} onChange={e => setPerson(e.target.value)}><option value="">All assignees</option>{people.map(p => <option key={p.userId} value={p.userId}>{p.displayName}</option>)}</select></label>
            <p className="sysmon-popover-help">Matches either assignment on a task.</p>
            <div className="sysmon-popover-footer"><button className="sysmon-tool-text" onClick={() => setPerson('')}>Reset</button><button className="sysmon-button" onClick={() => closePanel(true)}>Done</button></div>
          </div>}
        </div>
        <span className="sysmon-tools-divider" />
        <button className={'sysmon-tool-icon' + (search ? ' sysmon-tool-active' : '')} aria-label="Search tasks" title="Search tasks" aria-expanded={searchOpen} aria-controls="sysmon-quick-search" onClick={() => { setSearchOpen(!searchOpen); setPanel(null); }}><Search size={15} /></button>
        <button className="sysmon-tool-icon" aria-label="Refresh tasks" title="Refresh tasks" disabled={loading} onClick={onRefresh}><RefreshCw size={14} /></button>
        <button className="sysmon-primary sysmon-tool-create" disabled={loading || unavailable} onClick={onCreate}><Plus size={14} />New task</button>
      </div>
    </div>
    {searchOpen && <div id="sysmon-quick-search" className="sysmon-quick-search"><Search size={15} /><input ref={searchRef} className="sysmon-search-input" aria-label="Search task text" placeholder="Search title, ticket, or system…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setSearchOpen(false); root.current?.querySelector('[aria-label="Search tasks"]')?.focus(); } }} /><button className="sysmon-tool-icon" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={14} /></button></div>}
    {hasFilters && <div className="sysmon-active-filters" aria-label="Active filters">
      {[[type, 'Type', () => setType('')],[priority, 'Priority', () => setPriority('')],[status, 'Status', () => setStatus('')],[selectedPerson?.displayName, 'Assignee', () => setPerson('')],[search, 'Search', () => setSearch('')]].filter(([value]) => value).map(([value,label,clear]) => <button key={label} className="sysmon-filter-chip" onClick={clear} aria-label={'Remove ' + label.toLowerCase() + ' filter'}><span>{label}: {value}</span><X size={11} /></button>)}
      <button className="sysmon-tool-text" onClick={reset}>Clear all</button>
    </div>}
  </div>;
}
