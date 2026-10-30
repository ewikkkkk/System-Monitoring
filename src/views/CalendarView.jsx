import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getDeployments } from '../services/api.js';
import {groupDeploymentTasks,isDeploymentScheduled} from '../services/gantt-report.js';
import { taskReference } from '../task-utils.js';
import DeploymentSummaryModal from '../components/DeploymentSummaryModal.jsx';
import { localDayKey as dayKey } from '../services/deployment-report.js';

const formatTarget=value=>new Intl.DateTimeFormat('en',{dateStyle:'long'}).format(new Date(value+'T12:00:00'));
const timeLabel = value => new Intl.DateTimeFormat('en', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

export default function CalendarView({ tasks, status, onOpenTask }) {
  const now = new Date();
  const [month,setMonth]=useState(new Date(now.getFullYear(),now.getMonth(),1));
  const [selected,setSelected]=useState(dayKey(now)),[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [collapsedDates,setCollapsedDates]=useState(new Set());
  const [reportDate, setReportDate] = useState(null);
  async function refresh(){setLoading(true);setError('');try{setEvents(await getDeployments());}catch(error){setError(error.message);}finally{setLoading(false);}}
  useEffect(()=>{refresh();},[]);
  // The page remains the single scroll container except while the modal is open.
  const modalHost=useRef(null);
  useEffect(()=>{const page=modalHost.current?.closest('.sysmon-page');if(reportDate)page?.classList.add('sysmon-modal-open');return()=>page?.classList.remove('sysmon-modal-open');},[!!reportDate]);
  function toggleDate(key){setCollapsedDates(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next;});}
  const scheduled=tasks.filter(task=>isDeploymentScheduled(task,{includeComplete:status==='COMPLETE'}));
  const scopedEvents=events.filter(event=>tasks.some(task=>task.id===event.taskId));
  const monthEvents=scopedEvents.filter(event=>{const date=new Date(event.occurredAt);return date.getFullYear()===month.getFullYear()&&date.getMonth()===month.getMonth();});
  const monthTargets=scheduled.filter(task=>task.targetDeploymentDate?.slice(0,7)===dayKey(month).slice(0,7));
  const targetTasks=monthTargets.filter(task=>!selected||task.targetDeploymentDate.slice(0,10)===selected);
  const visible=monthEvents.filter(event=>!selected||dayKey(new Date(event.occurredAt))===selected);
  const first=new Date(month.getFullYear(),month.getMonth(),1), last=new Date(month.getFullYear(),month.getMonth()+1,0);
  const cells=Array.from({length:Math.ceil((first.getDay()+last.getDate())/7)*7},(_,index)=>index-first.getDay()+1);
  const reverted=new Set(events.filter(event=>event.action==='Revert').map(event=>event.revertsId));
  return <section ref={modalHost} aria-label="Production deployment calendar">
    <div className="sysmon-compact-toolbar sysmon-calendar-toolbar"><div><h2 className="sysmon-module-title">Production calendar</h2><p className="sysmon-popover-help">Deployments grouped automatically by task target date · Saved production history is read-only</p></div><div className="sysmon-tool-actions"><button className="sysmon-button" onClick={refresh} disabled={loading}><RefreshCw size={14}/>Refresh</button></div></div>
    {error?<p role="alert" className="sysmon-form-error">{error}</p>:loading?<p role="status" className="sysmon-muted">Loading production log…</p>:<>
      <div className="sysmon-calendar-monthbar"><div className="sysmon-tool-actions"><button className="sysmon-button" aria-label="Previous month" onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()-1,1));setSelected(null);}}><ChevronLeft size={16}/></button><h2 className="sysmon-panel-title">{new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(month)}</h2><button className="sysmon-button" aria-label="Next month" onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()+1,1));setSelected(null);}}><ChevronRight size={16}/></button></div><div className="sysmon-tool-actions"><span className="sysmon-muted">{monthEvents.length} events · {monthTargets.length} targets</span><button className="sysmon-button" onClick={()=>{setMonth(new Date(now.getFullYear(),now.getMonth(),1));setSelected(dayKey(now));}}>Today</button><button className="sysmon-button" onClick={()=>setSelected(null)}>All month</button></div></div>
      <div className="sysmon-calendar-grid" aria-label="Month days">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><div className="sysmon-calendar-weekday" key={day}>{day}</div>)}{cells.map((day,index)=>{
        if(day<1||day>last.getDate())return <div className="sysmon-calendar-blank" key={'blank'+index}/>;
        const key=dayKey(new Date(month.getFullYear(),month.getMonth(),day));
        const targets=monthTargets.filter(task=>task.targetDeploymentDate.slice(0,10)===key);
        const logs=monthEvents.filter(event=>dayKey(new Date(event.occurredAt))===key);
        return <button key={key} className={'sysmon-calendar-day'+(selected===key?' sysmon-calendar-day-selected':'')} aria-label={`${key}, ${logs.length} events, ${targets.length} targets`} aria-pressed={selected===key} aria-current={key===dayKey(now)?'date':undefined} aria-haspopup="dialog" onClick={()=>{setSelected(key);setReportDate(key);}}><span className="sysmon-calendar-day-number">{day}</span>{logs.length>0&&<span className="sysmon-calendar-day-count">{logs.length}<span className="sysmon-calendar-count-text"> {logs.length===1?'event':'events'}</span></span>}<span className="sysmon-calendar-target-count">{targets.length?`${targets.length} planned`:null}</span><span className="sysmon-calendar-dots">{['Deployment','Fix','Revert'].filter(action=>logs.some(event=>event.action===action)).map(action=><span key={action} className={'sysmon-dot sysmon-event-dot-'+action.toLowerCase()}/>)}</span></button>;
      })}</div>
      <div className="sysmon-calendar-legend">{['Deployment','Fix','Revert'].map(action=><span key={action}><span className={'sysmon-dot sysmon-event-dot-'+action.toLowerCase()}/>{action}</span>)}</div>
      <section className="sysmon-report-section" aria-label="Target deployments"><h2 className="sysmon-panel-title"><CalendarDays size={16}/>For Deployment <span className="sysmon-count">{targetTasks.length}</span></h2>{targetTasks.length?groupDeploymentTasks(targetTasks,{includeComplete:status==='COMPLETE'}).map(group=><section key={group.key} className="sysmon-calendar-deployment-group"><button className="sysmon-deployment-toggle" aria-label={`Deployment ${group.key}`} aria-expanded={!collapsedDates.has(group.key)} onClick={()=>toggleDate(group.key)}><ChevronRight size={14} className={!collapsedDates.has(group.key)?'sysmon-gantt-expanded':''}/>{formatTarget(group.key)}<span className="sysmon-count">{group.tasks.length}</span></button><div hidden={collapsedDates.has(group.key)}>{group.tasks.map(task=><button key={task.id} className="sysmon-calendar-target-task" onClick={()=>onOpenTask(task)}><strong>{taskReference(task)} · {task.title}</strong><span>{task.status}</span></button>)}</div></section>):<p className="sysmon-muted">No scheduled deployment tasks for this {selected?'date':'month'}. Set a target date in task details; Open/development tasks are hidden.</p>}</section>
      <section className="sysmon-report-section"><h2 className="sysmon-panel-title"><CalendarDays size={16}/> {selected?new Intl.DateTimeFormat('en',{dateStyle:'long'}).format(new Date(selected+'T12:00:00')):'All events this month'} <span className="sysmon-count">{visible.length}</span></h2>
        {visible.length?visible.map(event=>{const task=tasks.find(task=>task.id===event.taskId);return <article className="sysmon-deployment-row" key={event.id}><div className="sysmon-deployment-heading"><span className={'sysmon-event-label sysmon-event-label-'+event.action.toLowerCase()}>{event.action}</span><span>{timeLabel(event.occurredAt)}</span><span className="sysmon-muted">#{event.id} · {event.version}</span></div><button className="sysmon-deployment-task" disabled={!task} onClick={()=>onOpenTask(task)}>{taskReference(event)} · {event.title}</button><p className="sysmon-helpdesk-reference">IT Help Desk: {event.reference || 'Not linked'}</p><p className="sysmon-detail-description">{event.notes}</p><div className="sysmon-deployment-footer"><span className="sysmon-muted">{event.type} · {event.system||'System not specified'} · Logged by {event.actorId} at {timeLabel(event.recordedAt)}</span>{event.action==='Revert'?<span className="sysmon-muted">Reverts event #{event.revertsId}</span>:reverted.has(event.id)?<span className="sysmon-muted">Revert recorded</span>:null}</div></article>;}):<p className="sysmon-muted">No production events logged for this {selected?'date':'month'}.</p>}
      </section>
    </>}

    {reportDate&&<DeploymentSummaryModal date={reportDate} events={scopedEvents} plannedTasks={scheduled.filter(task=>task.targetDeploymentDate?.slice(0,10)===reportDate)} onClose={()=>setReportDate(null)}/>}
  </section>;
}
