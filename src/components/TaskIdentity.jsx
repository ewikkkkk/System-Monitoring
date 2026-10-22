import React from 'react';
import { Bug, Sparkles } from 'lucide-react';
import { taskReference, statuses } from '../task-utils.js';

export function StatusBadge({ status }) {
  return <span className="sysmon-status-badge"><span className={`sysmon-dot sysmon-status-${statuses.indexOf(status)}`} />{status}</span>;
}
export default function TaskIdentity({ task, onEdit, showTicketReference = true }) {
  return <button className="sysmon-task-button" onClick={() => onEdit(task)}>
    <span className="sysmon-task-ref">{task.type === 'Bug' ? <Bug size={13} /> : <Sparkles size={13} />}{taskReference(task)}</span>
    <span className="sysmon-task-title">{task.title}</span>
    {showTicketReference && task.reference && <span className="sysmon-helpdesk-reference">Help Desk: {task.reference}</span>}
    <span className="sysmon-muted">{task.system || 'System not specified'}{task.moduleName ? ` · ${task.moduleName}` : ''}</span>
  </button>;
}
