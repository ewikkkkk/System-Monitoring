import React from 'react';
import TaskIdentity from '../components/TaskIdentity.jsx';
import { formatDate, isComplete } from '../task-utils.js';
import { getHelpDeskTicketUrl } from '../services/api.js';

export default function ListView({ tasks, status, onEdit }) {
  const rows = tasks.filter(task => !isComplete(task) && (!status || task.status === status));
  return <div className="sysmon-list-view" aria-label="Pending bugs and enhancements">
    <div className="sysmon-flat-list-head" aria-hidden="true"><span>Concern / system</span><span>Reference ticket</span><span>Status</span><span>Developer</span><span>Tester</span><span>Priority</span><span>Due date</span></div>
    {rows.length ? rows.map(task => <article className="sysmon-flat-list-row" key={task.id}>
      <TaskIdentity task={task} onEdit={onEdit} showTicketReference={false}/>
      <div className="sysmon-flat-list-value"><span className="sysmon-flat-mobile-label">Reference ticket</span>{task.reference ? <a className="sysmon-ticket-link" href={getHelpDeskTicketUrl(task.reference)} target="_blank" rel="noopener noreferrer" aria-label={'Open Help Desk ticket ' + task.reference}>{task.reference}</a> : <span className="sysmon-muted">Not linked</span>}</div>
      <div className="sysmon-flat-list-value"><span className="sysmon-flat-mobile-label">Status</span>{task.status}</div>
      <div className="sysmon-flat-list-value"><span className="sysmon-flat-mobile-label">Developer</span>{task.developerName || 'Unassigned'}</div>
      <div className="sysmon-flat-list-value"><span className="sysmon-flat-mobile-label">Tester</span>{task.testerName || 'Unassigned'}</div>
      <div className="sysmon-flat-list-value"><span className="sysmon-flat-mobile-label">Priority</span>{task.priority}</div>
      <div className="sysmon-flat-list-value"><span className="sysmon-flat-mobile-label">Due date</span>{formatDate(task.dueDate)}</div>
    </article>) : <p className="sysmon-no-tasks">No pending bugs or enhancements match these filters.</p>}
  </div>;
}
