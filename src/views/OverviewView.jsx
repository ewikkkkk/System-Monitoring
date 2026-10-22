import React, { useState } from 'react';
import { ArrowRight, Bug, Sparkles, AlertCircle, Clock3 } from 'lucide-react';
import TaskIdentity, { StatusBadge } from '../components/TaskIdentity.jsx';
import { formatDate } from '../task-utils.js';
import { buildOverviewReport } from '../services/overview-report.js';
import BugTrends from '../components/BugTrends.jsx';

const rate = value => value == null ? '—' : value + '%';
const hours = value => Number(value.toFixed(2)) + ' h';
function ReportTable({ label, headings, children }) {
  return <table className="sysmon-report-table" aria-label={label}><thead><tr>{headings.map(h => <th className="sysmon-report-th" scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>;
}
function Cell({ children }) { return <td className="sysmon-report-td">{children}</td>; }

export default function OverviewView({ tasks, people, onEdit, onSelectStatus }) {
  const report = buildOverviewReport(tasks, people);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const attention = showAllAttention ? report.attention : report.attention.slice(0, 5);
  return <div className="sysmon-overview-view sysmon-detailed-report">
    <BugTrends tasks={tasks} onOpenTask={onEdit}/>
    <section className="sysmon-report-section">
      <div className="sysmon-report-heading"><div><h2 className="sysmon-panel-title">Enhancement & bug summary</h2><p className="sysmon-panel-description">Current filtered records · Completed means Prod live or Closed · Rates use all matching tasks.</p></div><span className="sysmon-report-asof">As of {formatDate(new Date().toISOString())}</span></div>
      <ReportTable label="Enhancement and bug summary" headings={['Work type','Total','Active','In testing','Completed','Completion rate','Overdue','Active estimates']}>
        {report.types.map(row => <tr key={row.type}><th className="sysmon-report-th sysmon-report-row-heading" scope="row"><span className="sysmon-report-kind">{row.type === 'Bug' ? <Bug size={14} /> : <Sparkles size={14} />}{row.type === 'Bug' ? 'Bugs' : 'Enhancements'}</span></th><Cell>{row.total}</Cell><Cell>{row.active}</Cell><Cell>{row.testing}</Cell><Cell>{row.completed}</Cell><Cell>{rate(row.completionRate)}</Cell><Cell>{row.overdue}</Cell><Cell>{hours(row.hours)}</Cell></tr>)}
        <tr className="sysmon-report-total"><th className="sysmon-report-th" scope="row">All tasks</th><Cell>{report.summary.total}</Cell><Cell>{report.summary.active}</Cell><Cell>{report.summary.testing}</Cell><Cell>{report.summary.completed}</Cell><Cell>{rate(report.summary.completionRate)}</Cell><Cell>{report.summary.overdue}</Cell><Cell>{hours(report.summary.hours)}</Cell></tr>
      </ReportTable>
      <div className="sysmon-report-facts"><span><strong>{report.createdThisWeek}</strong> created in the last 7 days</span><span><strong>{report.completedThisWeek}</strong> completed in the last 7 days</span><span><strong>{report.averageCompletionDays == null ? '—' : report.averageCompletionDays.toFixed(1) + ' days'}</strong> average creation-to-completion time</span></div>
      <p className="sysmon-report-note">Completion time uses {report.completionDateCount} tasks with valid creation and completion dates. Estimates are planned effort, not tracked time; tasks without estimates are excluded from hour totals.</p>
    </section>
    <section className="sysmon-report-section"><h2 className="sysmon-panel-title">Delivery status breakdown</h2><p className="sysmon-panel-description">Compare both work types at each stage. Select any status to inspect its list, including completed work.</p>
      <ReportTable label="Status breakdown" headings={['Status','Enhancements','Bugs','Total','Share of tasks']}>
        {report.statuses.map(row => <tr key={row.status}><th className="sysmon-report-th sysmon-report-row-heading" scope="row"><button className="sysmon-report-status-button" onClick={() => onSelectStatus(row.status)}><StatusBadge status={row.status} /><ArrowRight size={13} /></button></th><Cell>{row.enhancement}</Cell><Cell>{row.bug}</Cell><Cell>{row.total}</Cell><Cell>{rate(tasks.length ? Math.round(row.total / tasks.length * 100) : null)}</Cell></tr>)}
      </ReportTable>
    </section>
    <section className="sysmon-report-section"><h2 className="sysmon-panel-title">Priority & delivery readiness</h2><p className="sysmon-panel-description">Priority counts and readiness checks include active tasks only. A task may appear in multiple checks.</p>
      <ReportTable label="Active priority breakdown" headings={['Priority','Enhancements','Bugs','Active total']}>
        {report.priorities.map(row => <tr key={row.priority}><th className="sysmon-report-th sysmon-report-row-heading" scope="row"><span className={'sysmon-priority sysmon-priority-' + row.priority.toLowerCase()}>{row.priority}</span></th><Cell>{row.enhancement}</Cell><Cell>{row.bug}</Cell><Cell>{row.total}</Cell></tr>)}
      </ReportTable>
      <dl className="sysmon-readiness-list">{[['Overdue tasks',report.overdue.length],['Due today through the next 7 days',report.dueSoon.length],['Missing developer',report.missingDeveloper],['Missing tester',report.missingTester],['Missing due date',report.missingDueDate],['Missing estimate',report.missingEstimate]].map(([label,count]) => <div className="sysmon-readiness-row" key={label}><dt>{label}</dt><dd className="sysmon-readiness-count">{count}</dd></div>)}</dl>
    </section>
    <section className="sysmon-report-section"><h2 className="sysmon-panel-title"><AlertCircle size={16} /> Needs attention <span className="sysmon-count">{report.attention.length}</span></h2><p className="sysmon-panel-description">Overdue work first, followed by tasks with more priority or planning flags. Select any task for details.</p>
      {attention.length ? attention.map(({task,reasons}) => <div className="sysmon-report-task-row" key={task.id}><TaskIdentity task={task} onEdit={onEdit} /><div className="sysmon-attention-reasons">{reasons.map(reason => <span className="sysmon-attention-reason" key={reason}>{reason}</span>)}</div><span className="sysmon-muted">Due {formatDate(task.dueDate)}</span></div>) : <p className="sysmon-muted">No priority or planning flags in this task set.</p>}
      {report.attention.length > 5 && <button className="sysmon-button" onClick={() => setShowAllAttention(!showAllAttention)}>{showAllAttention ? 'Show fewer tasks' : 'Show all ' + report.attention.length + ' flagged tasks'}</button>}
    </section>
    <section className="sysmon-report-section"><h2 className="sysmon-panel-title"><Clock3 size={16} /> Upcoming due dates <span className="sysmon-count">{report.dueSoon.length}</span></h2><p className="sysmon-panel-description">Active tasks due today through the next 7 days.</p>
      {report.dueSoon.length ? [...report.dueSoon].sort((a,b) => String(a.dueDate).localeCompare(String(b.dueDate))).map(task => <div className="sysmon-report-task-row" key={task.id}><TaskIdentity task={task} onEdit={onEdit} /><StatusBadge status={task.status} /><span>{formatDate(task.dueDate)}</span></div>) : <p className="sysmon-muted">No active tasks with due dates in this window.</p>}
    </section>
    <section className="sysmon-report-section"><h2 className="sysmon-panel-title">Team workload & ownership</h2><p className="sysmon-panel-description">Active work only. Unique assigned tasks and hours count a person once per task, even when assigned as both developer and tester. Team hours may overlap across people.</p>
      <ReportTable label="Team workload report" headings={['Team member','Developer tasks','Tester tasks','Unique active tasks','Overdue','Planned hours']}>
        {report.workload.length ? report.workload.map(row => <tr key={row.userId}><th className="sysmon-report-th sysmon-report-row-heading" scope="row">{row.displayName}<span className="sysmon-workload-role">{row.assignmentRole}</span></th><Cell>{row.developer}</Cell><Cell>{row.tester}</Cell><Cell>{row.active}</Cell><Cell>{row.overdue}</Cell><Cell>{hours(row.hours)}</Cell></tr>) : <tr><td className="sysmon-report-td" colSpan={6}>No assignment directory available.</td></tr>}
      </ReportTable>
    </section>
    <section className="sysmon-report-section"><h2 className="sysmon-panel-title">System breakdown</h2><p className="sysmon-panel-description">Work volume, remaining backlog, and completed tasks by system.</p>
      <ReportTable label="System breakdown report" headings={['System','Enhancements','Bugs','Active','Completed','Overdue']}>
        {report.systems.length ? report.systems.map(row => <tr key={row.system}><th className="sysmon-report-th sysmon-report-row-heading" scope="row">{row.system}</th><Cell>{row.enhancement}</Cell><Cell>{row.bug}</Cell><Cell>{row.active}</Cell><Cell>{row.completed}</Cell><Cell>{row.overdue}</Cell></tr>) : <tr><td className="sysmon-report-td" colSpan={6}>No matching tasks.</td></tr>}
      </ReportTable>
    </section>
    <section className="sysmon-report-section"><h2 className="sysmon-panel-title">Recently updated</h2><p className="sysmon-panel-description">Five latest updates from the current filtered task set.</p>
      {report.recent.length ? report.recent.map(task => <div className="sysmon-report-task-row" key={task.id}><TaskIdentity task={task} onEdit={onEdit} /><StatusBadge status={task.status} /><span className="sysmon-muted">{formatDate(task.updatedAt)}</span></div>) : <p className="sysmon-muted">No tasks match these filters.</p>}
    </section>
  </div>;
}
