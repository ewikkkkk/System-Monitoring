import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { getTasks, getPeople, changeTaskStatus, saveTask, getTaskHistory, isMonitoringDemo, getHelpDeskTicketPreview } from './services/api.js';
import './system-monitoring.css';
import OverviewView from './views/OverviewView.jsx';
import ListView from './views/ListView.jsx';
import TaskModal from './components/TaskModal.jsx';
import ModuleSidebar from './components/ModuleSidebar.jsx';
import TaskDetailView from './views/TaskDetailView.jsx';
import CalendarView from './views/CalendarView.jsx';
import TaskToolbar from './components/TaskToolbar.jsx';
import { blankTask as blank, isComplete, taskReference } from './task-utils.js';
import HelpDeskTicketPage from './views/HelpDeskTicketPage.jsx';
import VoucherView from './views/VoucherView.jsx';

export default function SystemMonitoringPage(props) {
  const reference = getHelpDeskTicketPreview();
  return reference !== null ? <HelpDeskTicketPage reference={reference} darkMode={props.darkMode} /> : <MonitoringWorkspace {...props}/>;
}

function MonitoringWorkspace({ darkMode = false, onToggleDarkMode, onToggleSidebar }) {
  const [tasks, setTasks] = useState([]), [people, setPeople] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [type, setType] = useState(''), [person, setPerson] = useState(''), [status, setStatus] = useState('');
  const [editor, setEditor] = useState(null), [history, setHistory] = useState([]), [saving, setSaving] = useState(false), [editorError, setEditorError] = useState('');
  const [view, setView] = useState('overview');
  const [priority, setPriority] = useState('');
  const [localTheme, setLocalTheme] = useState(null);
  const activeDarkMode = onToggleDarkMode ? darkMode : localTheme ?? darkMode;
  const toggleDarkMode = () => {
    if (onToggleDarkMode) onToggleDarkMode();
    else setLocalTheme(!activeDarkMode);
  };
  const [selectedId, setSelectedId] = useState(null);
  const selectedTask = tasks.find(task => task.id === selectedId);
  const openTask = task => setSelectedId(task.id);
  const navigate = next => {
    if (next === 'list' && isComplete({ status })) setStatus('');
    setView(next); setSelectedId(null);
  };

  async function load() {
    setLoading(true); setError('');
    try { const [t, p] = await Promise.all([getTasks(), getPeople()]); setTasks(t); setPeople(p); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    let active = true; setHistory([]);
    if (editor?.id) getTaskHistory(editor.id).then(h => { if (active) setHistory(h); }).catch(e => { if (active) setEditorError(e.message); });
    return () => { active = false; };
  }, [editor?.id]);
  function edit(task = blank) { setEditorError(''); setEditor({ ...task, dueDate: task.dueDate?.slice(0, 10) || '', developerId: task.developerId || '', testerId: task.testerId || '', estimateHours: task.estimateHours ?? '' }); }
  async function submit(e) {
    e.preventDefault(); setSaving(true); setEditorError('');
    try { const saved = await saveTask(editor.id, { ...editor, estimateHours: editor.estimateHours === '' ? null : Number(editor.estimateHours) }); setEditor(null); setSelectedId(saved.id); await load(); }
    catch (e) { setEditorError(e.message); } finally { setSaving(false); }
  }
  async function updateTaskStatus(id, status) {
    const saved = await changeTaskStatus(id, status);
    setTasks(current => current.map(task => task.id === id ? { ...task, ...saved } : task));
  }
  const unfinishedTasks = tasks.filter(task => !isComplete(task));
  const viewTasks = view === 'list' ? unfinishedTasks : tasks;
  const filtered = viewTasks.filter(t => (!type || t.type === type) && (!priority || t.priority === priority) && (!status || t.status === status) && (!person || t.developerId === person || t.testerId === person) && `${taskReference(t)} ${t.title} ${t.reference} ${t.system} ${t.id}`.toLowerCase().includes(search.toLowerCase()));
  return <main className={`sysmon-page sysmon-layout ${activeDarkMode ? 'sysmon-dark' : ''} ${editor ? 'sysmon-modal-open' : ''}`}>
    <ModuleSidebar view={view} taskOpen={!!selectedTask} taskCount={unfinishedTasks.length} onNavigate={navigate} onCreate={() => edit()} disabled={loading || !!error} darkMode={activeDarkMode} onToggleDarkMode={toggleDarkMode} />
    <div className="sysmon-content">
    {isMonitoringDemo() && <div className="sysmon-demo-banner" role="status">Demo workspace · Sample people and tasks · Changes are saved locally</div>}
    {selectedTask ? <TaskDetailView task={selectedTask} onBack={() => setSelectedId(null)} onEdit={edit} onStatusChange={updateTaskStatus} /> : view === 'vouchers' ? <VoucherView/> : view === 'calendar' ? <CalendarView tasks={tasks} onOpenTask={openTask} /> : <>
    <div className="sysmon-workspace"><TaskToolbar view={view} count={filtered.length} people={people} search={search} setSearch={setSearch} type={type} setType={setType} priority={priority} setPriority={setPriority} person={person} setPerson={setPerson} status={status} setStatus={setStatus} onCreate={() => edit()} onRefresh={load} loading={loading} unavailable={!!error} />
    {error ? <div className="sysmon-empty" role="alert"><AlertCircle size={28} /><h2 className="sysmon-empty-title">Database connection needed</h2><p>{error}</p><button className="sysmon-button" onClick={load}>Try again</button></div> : loading ? <div className="sysmon-empty" role="status">Loading task register…</div> : <section id="sysmon-view-panel" aria-label={`${view} tasks`} tabIndex={0} className="sysmon-view-panel">
      {view === 'overview' && <OverviewView tasks={filtered} people={people} onEdit={openTask} onSelectStatus={s => { setStatus(s); setView('list'); }} />}
      {view === 'list' && <ListView tasks={filtered} status={status} onEdit={openTask} />}
    </section>}
    <div className="sysmon-footer">{error ? 'Waiting for SQL Server' : loading ? 'Connecting…' : `${filtered.length} of ${viewTasks.length} ${view === 'list' ? 'unfinished tasks' : 'tasks'}`}<span>{view === 'list' ? 'Unfinished concerns only · Completed work remains in Overview and Calendar' : 'Select a task to view details · Filters apply to all views'}</span></div></div>
    </>}
    </div>
    {editor && <TaskModal editor={editor} setEditor={setEditor} history={history} saving={saving} editorError={editorError} submit={submit} people={people} onClose={() => setEditor(null)} />}
  </main>;
}
