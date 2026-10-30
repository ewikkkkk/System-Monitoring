import React, { useEffect, useState } from 'react';
import { AlertCircle, List, Columns3, ChartGantt, CalendarDays } from 'lucide-react';
import { getTasks, getMyTasks, getMonitoringPermissions, getPeople, saveTask, getTaskHistory, isMonitoringDemo, getHelpDeskTicketPreview } from './services/api.js';
import './system-monitoring.css';
import OverviewView from './views/OverviewView.jsx';
import ListView from './views/ListView.jsx';
import KanbanView from './views/KanbanView.jsx';
import GanttView from './views/GanttView.jsx';
import TaskDetailsModal from './components/TaskDetailsModal.jsx';
import TaskModal from './components/TaskModal.jsx';
import ModuleSidebar from './components/ModuleSidebar.jsx';
import CalendarView from './views/CalendarView.jsx';
import TaskToolbar from './components/TaskToolbar.jsx';
import { blankTask as blank, isComplete, taskReference } from './task-utils.js';
import HelpDeskTicketPage from './views/HelpDeskTicketPage.jsx';
import VoucherView from './views/VoucherView.jsx';
import TicketReportsView from './views/TicketReportsView.jsx';
import { listTasksForStatus, parseRelatedTickets } from '../shared/related-tickets.js';

export default function SystemMonitoringPage(props) {
  const reference = getHelpDeskTicketPreview();
  return reference !== null ? <HelpDeskTicketPage reference={reference} darkMode={props.darkMode} /> : <MonitoringWorkspace {...props}/>;
}

function MonitoringWorkspace({ darkMode = false, onToggleDarkMode, onToggleSidebar }) {
  const [myTasks,setMyTasks]=useState([]),[canManageDeploymentDates,setCanManageDeploymentDates]=useState(false);
  const [tasks, setTasks] = useState([]), [people, setPeople] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [type, setType] = useState(''), [person, setPerson] = useState(''), [status, setStatus] = useState('');
  const [editor, setEditor] = useState(null), [history, setHistory] = useState([]), [saving, setSaving] = useState(false), [editorError, setEditorError] = useState('');
  const [view, setView] = useState('overview');
  const [taskLayout,setTaskLayout]=useState('list'),[kanbanId,setKanbanId]=useState(null);
  const kanbanTask=tasks.find(task=>task.id===kanbanId);
  const [priority, setPriority] = useState('');
  const [localTheme, setLocalTheme] = useState(null);
  const activeDarkMode = onToggleDarkMode ? darkMode : localTheme ?? darkMode;
  const toggleDarkMode = () => {
    if (onToggleDarkMode) onToggleDarkMode();
    else setLocalTheme(!activeDarkMode);
  };
  const openTask = task => setKanbanId(task.id);
  const navigate = next => {
    setView(next);setKanbanId(null);
  };

  async function load() {
    setLoading(true); setError('');
    try { const [t, p, mine, permissions] = await Promise.all([getTasks(), getPeople(),getMyTasks(),getMonitoringPermissions()]); setTasks(t); setPeople(p);setMyTasks(mine);setCanManageDeploymentDates(permissions.canManageDeploymentDates===true); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    let active = true; setHistory([]);
    if (editor?.id) getTaskHistory(editor.id).then(h => { if (active) setHistory(h); }).catch(e => { if (active) setEditorError(e.message); });
    return () => { active = false; };
  }, [editor?.id]);
  function edit(task = blank) { setKanbanId(null);setEditorError(''); setEditor({ ...task, initialCommentRequestId:crypto.randomUUID(), remarks:task.remarks||'', moduleName:task.moduleName || '', relatedTicketsText: (task.relatedTickets || []).join('\n'), targetDeploymentDate:task.targetDeploymentDate?.slice(0,10)||'', developerId: task.developerId || '', testerId: task.testerId || '', estimateHours: task.estimateHours ?? '' }); }
  function taskWriteBody(body,previous){
    const {dueDate,targetDeploymentDate,...rest}=body;
    const target=targetDeploymentDate||'',old=previous?.targetDeploymentDate?.slice(0,10)||'';
    return {...rest,...(canManageDeploymentDates&&target!==old?{targetDeploymentDate:target}:{})};
  }
  async function submit(e) {
    e.preventDefault(); setSaving(true); setEditorError('');
    try { const saved = await saveTask(editor.id, taskWriteBody({ ...editor, notes:editor.id?editor.notes:'',newComment:!editor.id&&editor.notes.trim()?{requestId:editor.initialCommentRequestId,text:editor.notes}:undefined, relatedTickets: parseRelatedTickets(editor.relatedTicketsText), estimateHours: editor.estimateHours === '' ? null : Number(editor.estimateHours) },tasks.find(task=>task.id===editor.id))); setEditor(null); setKanbanId(saved.id); await load(); }
    catch (e) { setEditorError(e.message); } finally { setSaving(false); }
  }
  const unfinishedTasks = tasks.filter(task => !isComplete(task));
  const kanbanActive=view==='list'&&taskLayout==='kanban',planningActive=view==='list'&&taskLayout!=='list';
  const viewTasks = kanbanActive ? myTasks : view === 'list'&&!planningActive ? listTasksForStatus(tasks, status) : tasks;
  const filtered = viewTasks.filter(t => (!type || t.type === type) && (!priority || t.priority === priority) && (!status || t.status === status) && (!person || t.developerId === person || t.testerId === person) && `${taskReference(t)} ${t.title} ${t.reference} ${(t.relatedTickets || []).join(' ')} ${t.system} ${t.moduleName || ''} ${t.id}`.toLowerCase().includes(search.toLowerCase()));
  return <main className={`sysmon-page sysmon-layout ${activeDarkMode ? 'sysmon-dark' : ''} ${editor ? 'sysmon-modal-open' : ''}`} style={editor||kanbanTask?{overflow:'hidden'}:undefined}>
    <ModuleSidebar view={view} taskOpen={!!kanbanTask} taskCount={unfinishedTasks.length} onNavigate={navigate} onCreate={() => edit()} disabled={loading || !!error} darkMode={activeDarkMode} onToggleDarkMode={toggleDarkMode} />
    <div className="sysmon-content">
    {isMonitoringDemo() && <div className="sysmon-demo-banner" role="status">Demo workspace · Sample people and tasks · Changes are saved locally</div>}
    {view === 'ticket-reports' ? <TicketReportsView/> : view === 'vouchers' ? <VoucherView/> : view === 'calendar' ? <CalendarView tasks={tasks} status={status} onOpenTask={openTask} /> : <>
    <div className="sysmon-workspace"><TaskToolbar view={planningActive?taskLayout:view} count={filtered.length} people={people} search={search} setSearch={setSearch} type={type} setType={setType} priority={priority} setPriority={setPriority} person={person} setPerson={setPerson} status={status} setStatus={setStatus} onCreate={() => edit()} onRefresh={load} loading={loading} unavailable={!!error} />
    {error ? <div className="sysmon-empty" role="alert"><AlertCircle size={28} /><h2 className="sysmon-empty-title">Database connection needed</h2><p>{error}</p><button className="sysmon-button" onClick={load}>Try again</button></div> : loading ? <div className="sysmon-empty" role="status">Loading task register…</div> : <section id="sysmon-view-panel" aria-label={`${view} tasks`} tabIndex={0} className="sysmon-view-panel">
      {view === 'overview' && <OverviewView tasks={filtered} people={people} onEdit={openTask} onSelectStatus={s => { setStatus(s); setView('list'); }} />}
      {view==='list'&&<><div className="sysmon-task-layout-switch" role="group" aria-label="Task display">{[['list','List view',List],['kanban','Kanban view',Columns3],['gantt','Gantt view',ChartGantt],['calendar','Calendar',CalendarDays]].map(([key,label,Icon])=><button key={key} className={'sysmon-tool-pill'+(taskLayout===key?' sysmon-tool-active':'')} aria-pressed={taskLayout===key} onClick={()=>setTaskLayout(key)}><Icon size={15}/>{label}</button>)}</div>{taskLayout==='kanban'?<KanbanView tasks={filtered} people={people} person={person} status={status} onSelectStatus={setStatus} onOpen={openTask}/>:taskLayout==='gantt'?<GanttView tasks={filtered} status={status} onOpen={openTask}/>:taskLayout==='calendar'?<CalendarView tasks={filtered} status={status} onOpenTask={openTask}/>:<ListView tasks={filtered} status={status} onEdit={openTask}/>}</>}

    </section>}
    <div className="sysmon-footer">{error ? 'Waiting for SQL Server' : loading ? 'Connecting…' : `${filtered.length} of ${viewTasks.length} ${view === 'list' && !status && !planningActive ? 'unfinished tasks' : 'tasks'}`}<span>{kanbanActive ? 'Workflow board · Cards are grouped by stage' : planningActive ? 'Target dates are planned · Actual production events are in Calendar' : view === 'list' ? 'Unfinished by default · Select PROD LIVE (HYPERCARE) or COMPLETE to review completed work' : 'Select a task to view details · Filters apply to all views'}</span></div></div>
    </>}
    </div>
    {editor && <TaskModal canManageDeploymentDates={canManageDeploymentDates} editor={editor} setEditor={setEditor} history={history} saving={saving} editorError={editorError} submit={submit} people={people} onClose={() => setEditor(null)} />}
    {kanbanTask&&!editor&&<TaskDetailsModal canManageDeploymentDates={canManageDeploymentDates} key={kanbanTask.id} task={kanbanTask} people={people} onClose={()=>setKanbanId(null)} onSave={async(id,body)=>{await saveTask(id,taskWriteBody(body,tasks.find(task=>task.id===id)));const [fresh,mine]=await Promise.all([getTasks(),getMyTasks()]);setTasks(fresh);setMyTasks(mine);return fresh.find(task=>task.id===id);}} onRefresh={load}/>}
  </main>;
}
