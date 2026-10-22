import React, { useEffect, useMemo, useState } from 'react';
import { Bug, RefreshCw, Rocket } from 'lucide-react';
import { getBugOccurrences, getDeployments, getTaskResolutions, isMonitoringDemo } from '../services/api.js';
import { buildBugTrend, compareDeployment } from '../services/bug-trends.js';
import { taskReference } from '../task-utils.js';
import { getHelpDeskTicketUrl } from '../services/api.js';

const dayLabel = date => new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(date);
const timeLabel = at => new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(at));

export default function BugTrends({ tasks, onOpenTask }) {
  const [occurrences,setOccurrences]=useState([]),[deployments,setDeployments]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [resolutions,setResolutions]=useState([]);
  const [days,setDays]=useState(30),[system,setSystem]=useState(''),[selected,setSelected]=useState(''),[deploymentId,setDeploymentId]=useState('');
  const [now,setNow]=useState(()=>new Date());
  async function load(){setLoading(true);setError('');try{const [events,releases,resolved]=await Promise.all([getBugOccurrences(),getDeployments(),getTaskResolutions()]);setOccurrences(events);setDeployments(releases);setResolutions(resolved);setNow(new Date());}catch(error){setError(error.message);}finally{setLoading(false);}}
  useEffect(()=>{load();},[]);
  const systems=[...new Set(tasks.map(task=>task.system).filter(Boolean))].sort();
  const activeSystem=systems.includes(system)?system:'';
  const trend=useMemo(()=>buildBugTrend(tasks,occurrences,deployments,{days,now,system:activeSystem,resolutions}),[tasks,occurrences,deployments,days,now,activeSystem,resolutions]);
  const row=trend.rows.find(row=>row.key===selected)||[...trend.rows].reverse().find(row=>row.entries.length||row.releases.length||row.resolved.length)||trend.rows.at(-1);
  const deployment=trend.releases.find(event=>event.id===Number(deploymentId));
  const comparison=deployment?compareDeployment(trend.events,deployment,now):null;
  const max=Math.max(4,...trend.rows.map(row=>Math.max(row.entries.length,row.resolved.length))),step=Math.max(1,Math.ceil(max/4)),top=step*4;
  const width=940,height=252,left=34,right=16,baseline=210,plotHeight=170,band=(width-left-right)/days;
  return <section className="sysmon-report-section sysmon-bug-trends" aria-labelledby="sysmon-bug-trends-title">
    <div className="sysmon-report-heading"><div><h2 id="sysmon-bug-trends-title" className="sysmon-panel-title"><Bug size={17}/> Bug activity & resolutions</h2><p className="sysmon-panel-description">Daily bug reports and resolved bugs/enhancements, with production markers. Current task filters apply.</p></div><div className="sysmon-trend-controls"><select className="sysmon-input" aria-label="Bug trend date range" value={days} onChange={event=>{setDays(Number(event.target.value));setSelected('');}}>{[7,14,30,90].map(value=><option value={value} key={value}>Last {value} days</option>)}</select><select className="sysmon-input" aria-label="Bug trend system" value={activeSystem} onChange={event=>{setSystem(event.target.value);setDeploymentId('');}}><option value="">All systems</option>{systems.map(value=><option key={value}>{value}</option>)}</select><button className="sysmon-button" aria-label="Refresh bug activity" onClick={load} disabled={loading}><RefreshCw size={15}/></button></div></div>
    {loading?<p className="sysmon-muted" role="status">Loading bug activity…</p>:error?<p className="sysmon-form-error" role="alert">{error} <button className="sysmon-button" onClick={load}>Retry</button></p>:<>
      <div className="sysmon-pending-totals" aria-label="Current pending totals"><div><span className="sysmon-muted">Pending bugs</span><strong>{trend.pendingBugs}</strong></div><div><span className="sysmon-muted">Pending enhancements</span><strong>{trend.pendingEnhancements}</strong></div><div><span className="sysmon-muted">Total pending</span><strong>{trend.pendingBugs+trend.pendingEnhancements}</strong></div><p className="sysmon-report-note">Current filters · all dates · excludes Prod live and Closed</p></div>
      <div className="sysmon-trend-summary"><span><strong>{trend.newBugs}</strong> new bug {trend.newBugs===1?'task':'tasks'}</span><span><strong>{trend.recurrences}</strong> {trend.recurrences===1?'recurrence':'recurrences'}</span><span><strong>{trend.resolvedBugs}</strong> resolved bugs</span><span><strong>{trend.resolvedEnhancements}</strong> resolved enhancements</span><span className="sysmon-muted">Last {days} days</span></div>
      <div className="sysmon-trend-legend"><span><i className="sysmon-legend-new"/>New bug tasks</span><span><i className="sysmon-legend-recurrence"/>Recurrences</span><span><i className="sysmon-legend-resolved"/>Resolved tasks</span><span><i className="sysmon-legend-deployment"/>Production events</span></div>
      <svg className="sysmon-trend-chart" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Daily bug reports, resolved tasks and production event markers">
        {[0,1,2,3,4].map(index=><g key={index}><line x1={left} x2={width-right} y1={baseline-index*plotHeight/4} y2={baseline-index*plotHeight/4} className="sysmon-chart-grid"/><text x={left-10} y={baseline-index*plotHeight/4+4} textAnchor="end" className="sysmon-chart-label">{index*step}</text></g>)}
        {trend.rows.map((day,index)=>{const x=left+index*band+band/2,bar=Math.min(18,band*.3),newHeight=day.newBugs/top*plotHeight,recurHeight=day.recurrences/top*plotHeight,resolvedHeight=day.resolved.length/top*plotHeight;return <g key={day.key} role="button" tabIndex={0} aria-label={`${day.key}: ${day.newBugs} new bug tasks, ${day.recurrences} recurrences, ${day.resolvedBugs} resolved bugs, ${day.resolvedEnhancements} resolved enhancements, ${day.releases.length} production events`} className="sysmon-chart-day" onClick={()=>setSelected(day.key)} onFocus={()=>setSelected(day.key)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(day.key);}}}>
          <rect x={x-band/2+1} y={26} width={Math.max(1,band-2)} height={baseline-26} className={row.key===day.key?'sysmon-chart-selected':'sysmon-chart-hit'}/>
          {day.releases.length>0&&<><line x1={x} x2={x} y1={25} y2={baseline} className="sysmon-chart-release-line"/><path d={`M${x},15 l5,5 l-5,5 l-5,-5 z`} className="sysmon-chart-release"/></>}
          <rect x={x-bar-1} y={baseline-newHeight} width={bar} height={newHeight} rx={2} className="sysmon-chart-new"/><rect x={x-bar-1} y={baseline-newHeight-recurHeight} width={bar} height={recurHeight} rx={2} className="sysmon-chart-recurrence"/><rect x={x+1} y={baseline-resolvedHeight} width={bar} height={resolvedHeight} rx={2} className="sysmon-chart-resolved"/>
          {(index===0||index===days-1||index%Math.max(1,Math.ceil(days/7))===0)&&<text x={x} y={235} textAnchor="middle" className="sysmon-chart-label">{dayLabel(day.date)}</text>}
          <title>{day.key}: {day.entries.length} bug reports; {day.resolved.length} resolved tasks; {day.releases.length} production events</title>
        </g>;})}
      </svg>
      {!trend.total&&!trend.resolvedBugs&&!trend.resolvedEnhancements&&<p className="sysmon-muted">No bug reports or resolutions recorded in this date range for the current filters.</p>}
      <div className="sysmon-trend-day-detail" aria-live="polite"><div className="sysmon-trend-day-heading"><strong>{dayLabel(row.date)}</strong><span className="sysmon-muted">{row.newBugs} new · {row.recurrences} recurring · {row.resolvedBugs} bugs / {row.resolvedEnhancements} enhancements resolved · {row.releases.length} production {row.releases.length===1?'event':'events'}</span></div>
        {row.entries.map(event=><div key={event.key} className="sysmon-trend-entry"><span className="sysmon-muted">{event.kind}</span><button className="sysmon-tool-text" onClick={()=>onOpenTask(event.task)}>{taskReference(event.task)} · {event.task.title}</button>{event.reference&&<a className="sysmon-ticket-link" href={getHelpDeskTicketUrl(event.reference)} target="_blank" rel="noopener noreferrer">{event.reference}</a>}</div>)}
        {row.resolved.map(event=><div key={`resolved-${event.taskId}`} className="sysmon-trend-entry"><span className="sysmon-resolved-label">Resolved {event.task.type.toLowerCase()}</span><button className="sysmon-tool-text" onClick={()=>onOpenTask(event.task)}>{taskReference(event.task)} · {event.task.title}</button><span className="sysmon-muted">{timeLabel(event.occurredAt)}</span></div>)}
        {row.releases.map(event=><div className="sysmon-trend-entry" key={event.id}><Rocket size={13}/><span>{event.action} · {event.version} · {event.system||'Unspecified system'} · {timeLabel(event.occurredAt)}</span></div>)}
        {!row.entries.length&&!row.releases.length&&!row.resolved.length&&<p className="sysmon-muted">No recorded activity on this date.</p>}
      </div>
      <label className="sysmon-field sysmon-trend-comparison-select">Compare a production event<select className="sysmon-input" value={deployment?.id||''} onChange={event=>setDeploymentId(event.target.value)}><option value="">Select a deployment or fix</option>{trend.releases.filter(event=>event.action!=='Revert').sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).map(event=><option key={event.id} value={event.id}>{event.version} · {event.system||'Unspecified'} · {timeLabel(event.occurredAt)}</option>)}</select></label>
      {comparison&&<div className="sysmon-trend-comparison"><span><strong>{comparison.before}</strong> same-system reports in 7 days before</span><span><strong>{comparison.after}</strong> same-system reports in 7 days after{comparison.partial?' (window still open)':''}</span><span><strong>{comparison.linked}</strong> recurrences explicitly linked to this event</span></div>}
      <p className="sysmon-report-note">{isMonitoringDemo()?'Demo records. ':''}As of {timeLabel(now)}. New bugs use task creation time; recurrences use their recorded occurrence time. Resolved means entering Prod live or Closed, counted once per task per local day. Later completion edits are not new resolutions; historical resolutions remain after reopening. Completion dates are used only when a task has no resolution history. Pending totals use current statuses across all dates. Zero means no saved reports. Production markers and comparisons provide timing context, not proof of deployment causality. Comparisons use exact event times and 168-hour windows, independent of chart range. Related tickets alone do not add recurrence counts.</p>
    </>}
  </section>;
}
