import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Pencil, CircleDot, CalendarDays, Users, UserRoundCheck, Flag, Hourglass, Layers, CheckCircle2, FileText, MessageSquare, History, ChevronDown, ChevronUp, Ticket } from 'lucide-react';
import ActivityHistoryModal from '../components/ActivityHistoryModal.jsx';
import BugRecurrences from '../components/BugRecurrences.jsx';
import { getHelpDeskTicketUrl } from '../services/api.js';
import { formatDate, taskReference, statuses } from '../task-utils.js';

function Property({ icon: Icon, label, children }) {
  return <div className="sysmon-detail-property"><dt className="sysmon-detail-label"><Icon size={16} />{label}</dt><dd className="sysmon-detail-value">{children}</dd></div>;
}

export default function TaskDetailView({ task, onBack, onEdit, onStatusChange, onRefresh }) {
  const [statusSaving, setStatusSaving] = useState(false), [statusFeedback, setStatusFeedback] = useState(''), [statusError, setStatusError] = useState('');
  async function updateStatus(next) {
    if (next === task.status) return;
    setStatusSaving(true); setStatusFeedback(''); setStatusError('');
    try { await onStatusChange(task.id, next); setStatusFeedback('Status saved'); }
    catch (error) { setStatusError(error.message); }
    finally { setStatusSaving(false); }
  }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); setExpanded(false); setStatusFeedback(''); setStatusError(''); setHistoryOpen(false); }, [task.id]);
  const description = task.description || 'No description added yet.';
  const needsExpand = description.length > 900;
  return <article className="sysmon-task-detail" aria-label="Task detail">
    <div className="sysmon-detail-breadcrumb"><button className="sysmon-back-button" onClick={onBack}><ArrowLeft size={15} /> Back to tasks</button><span className="sysmon-muted">/</span><span className="sysmon-muted">{task.system || 'System monitoring'}</span><span className="sysmon-muted">/</span><span>{taskReference(task)}</span></div>
    <div className="sysmon-detail-heading"><div><span className="sysmon-task-kind"><CircleDot size={13} />{task.type}</span><h1 ref={heading} tabIndex={-1} className="sysmon-detail-reference">{taskReference(task)}</h1><p className="sysmon-detail-subtitle">{task.title}</p></div><div className="sysmon-task-actions"><button className="sysmon-history-trigger" aria-label="View activity history" title="Activity history" aria-haspopup="dialog" onClick={() => setHistoryOpen(true)}><History size={18}/></button><button className="sysmon-button" onClick={() => onEdit(task)}><Pencil size={15} /> Edit task</button></div></div>
    <dl className="sysmon-detail-properties">
      <Property icon={CircleDot} label="Status"><select className="sysmon-input sysmon-inline-status" aria-label="Task status" value={task.status} disabled={statusSaving} onChange={event => updateStatus(event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select><span className="sysmon-inline-feedback" role="status">{statusSaving ? 'Saving…' : statusFeedback}</span>{statusError && <span className="sysmon-form-error" role="alert">{statusError}</span>}</Property>
      <Property icon={Users} label="Developer"><span className="sysmon-person-value">{task.developerName && <span className="sysmon-avatar">{task.developerName.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>}{task.developerName || 'Unassigned'}</span></Property>
      <Property icon={CalendarDays} label="Due date">{formatDate(task.dueDate)}</Property>
      <Property icon={Flag} label="Priority"><span className={`sysmon-priority sysmon-priority-${task.priority.toLowerCase()}`}>{task.priority}</span></Property>
      <Property icon={Hourglass} label="Time estimate">{task.estimateHours == null ? 'Not estimated' : `${task.estimateHours} hours`}</Property>
      <Property icon={Layers} label="System">{task.system || 'Not specified'}</Property>
      <Property icon={FileText} label="Module">{task.moduleName || 'Not specified'}</Property>
      <Property icon={Ticket} label="Help Desk ticket">{task.reference || 'Not linked'}</Property>
      <Property icon={CalendarDays} label="Created">{formatDate(task.createdAt)}</Property>
      <Property icon={CheckCircle2} label="Completed">{task.completedAt ? formatDate(task.completedAt) : 'Not completed'}</Property>
    </dl>
    <section className="sysmon-detail-section"><h2 className="sysmon-detail-section-title"><Ticket size={16}/> Other related tickets</h2>{task.relatedTickets?.length?<div className="sysmon-related-tickets">{task.relatedTickets.map(reference=><a key={reference} className="sysmon-ticket-link" href={getHelpDeskTicketUrl(reference)} target="_blank" rel="noopener noreferrer">{reference}</a>)}</div>:<p className="sysmon-muted">No related tickets added. Add references through Edit task.</p>}</section>
    {task.type==='Bug'&&<BugRecurrences task={task} onRefresh={onRefresh}/>}
    <section className="sysmon-detail-section"><h2 className="sysmon-detail-section-title"><FileText size={17} />{task.type === 'Enhancement' ? 'System enhancement request' : 'Bug report'}</h2><h3 className="sysmon-description-title">{task.title}</h3>
      <p className="sysmon-detail-description">{needsExpand && !expanded ? `${description.slice(0, 900)}…` : description}</p>
      {needsExpand && <button className="sysmon-button sysmon-expand-description" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{expanded ? 'Show less' : 'Expand description'}</button>}
    </section>
    <section className="sysmon-detail-section"><h2 className="sysmon-detail-section-title"><UserRoundCheck size={17} /> Testing</h2><dl className="sysmon-testing-fields"><Property icon={UserRoundCheck} label="Tester"><span className="sysmon-person-value">{task.testerName && <span className="sysmon-avatar sysmon-tester-avatar">{task.testerName.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>}{task.testerName || 'Unassigned'}</span></Property></dl></section>
    <section className="sysmon-detail-section"><h2 className="sysmon-detail-section-title"><MessageSquare size={17} /> Progress & testing notes</h2><p className="sysmon-detail-description">{task.notes || 'No progress notes added yet.'}</p></section>
    {historyOpen && <ActivityHistoryModal task={task} onClose={() => setHistoryOpen(false)} />}
  </article>;
}
