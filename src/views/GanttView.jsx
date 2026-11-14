import React,{useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight,RefreshCw,CalendarDays} from 'lucide-react';
import {getTaskTimeline} from '../services/api.js';
import {taskReference,formatDate} from '../task-utils.js';
import {buildGanttReport,dayIndex,dayKeyFromIndex,timelinePosition,deploymentGroupPosition,deploymentTaskAppearance,deploymentGroupAppearance} from '../services/gantt-report.js';
import {localDayKey} from '../services/deployment-report.js';
function DeploymentDateLine({group,start,days,today,expanded,onToggle}){
 const appearance=deploymentGroupAppearance(group,today);
 const position=deploymentGroupPosition(group,start,days,appearance.missedCount?today:undefined);
 const status=`${appearance.label}${appearance.missedCount?` (${appearance.missedCount})`:''}`;
 return <button className={`sysmon-deployment-date-line sysmon-gantt-state-${appearance.key}`} aria-label={`Expand deployment timeline ${group.key}`} aria-expanded={expanded} aria-controls={`sysmon-deployment-rows-${group.key}`} onClick={onToggle} title={`Target deployment: ${formatDate(group.key)}. ${appearance.label}. ${appearance.description}`}>
  {position.planned&&<span className="sysmon-deployment-date-rule" style={segmentStyle(position.planned)}/>}
  {position.overdue&&<span className="sysmon-deployment-date-rule sysmon-deployment-date-overdue" style={segmentStyle(position.overdue)}/>}
  {position.target!=null?<><span className="sysmon-deployment-group-target" style={{left:`${position.target}%`}}/><span className="sysmon-deployment-target-label" style={{left:`clamp(60px, ${position.target}%, calc(100% - 60px))`}}>{formatDate(group.key)}<span className="sysmon-deployment-group-status">{status}</span></span></>:<span className="sysmon-deployment-target-outside">{formatDate(group.key)} &middot; {position.overdue?status:`Target ${dayIndex(group.key)<start?'before':'after'} displayed range`}</span>}
 </button>;
}
const segmentStyle=({left,width})=>({left:`${left}%`,width:`${width}%`});

function DeploymentTaskRow({row,start,days,today,grid,onOpen}){
 const {task}=row;
 const appearance=deploymentTaskAppearance(task,today);
 const {planned,overdue,target}=timelinePosition(row,start,days,appearance.missed?today:undefined);
 const width=(planned?.width??0)+(overdue?.width??0);
 const reference=taskReference(task);
 const open=()=>onOpen(task);
 const dates=[planned&&`Development ${formatDate(row.start)}`,`Target deployment ${formatDate(row.target)}`,overdue&&`Overdue through ${formatDate(today)}`].filter(Boolean).join(' · ');
 return <div className="sysmon-deployment-gantt-row">
  <button className="sysmon-deployment-gantt-label sysmon-deployment-task" aria-label={`Open ${reference}: ${task.title}`} title={`${task.title} · ${task.developerName||'Unassigned developer'} / ${task.testerName||'Unassigned tester'}`} onClick={open}>
   <strong>{reference}</strong><span>{task.status}</span>{appearance.missed&&<span className="sysmon-gantt-missed-label">Missed deployment</span>}
  </button>
  <div className="sysmon-deployment-track">{grid()}
   {width>0&&<button className="sysmon-gantt-bar" style={{...segmentStyle({left:(planned||overdue).left,width}),'--sm-gantt-planned-share':`${(planned?.width??0)/width*100}%`}} aria-label={`Open ${reference}, ${dates}`} title={`${dates} · ${task.status}`} onClick={open}>{reference}</button>}
   {target!=null&&<button className="sysmon-gantt-target" style={{left:`${target}%`}} aria-label={`${reference} target deployment ${row.target}`} onClick={open}/>}
   {(row.issue||(!width&&target==null))&&<span className="sysmon-gantt-issue">{row.issue||'Outside selected timeline range'}</span>}
  </div>
 </div>;
}
export default function GanttView({tasks,status,onOpen}){
 const [timeline,setTimeline]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[days,setDays]=useState(28),[start,setStart]=useState(()=>dayIndex(localDayKey(new Date()))-7),[expanded,setExpanded]=useState(true),[opened,setOpened]=useState(new Set()),[completion,setCompletion]=useState('all'),[today,setToday]=useState(()=>localDayKey(new Date()));
 async function refresh(){setLoading(true);setError('');try{setTimeline(await getTaskTimeline());}catch(error){setError(error.message);}finally{setLoading(false);}}
 useEffect(()=>{refresh();const timer=setInterval(()=>setToday(localDayKey(new Date())),60000);return()=>clearInterval(timer);},[]);
 const groups=buildGanttReport(tasks,timeline,{completion}),dates=Array.from({length:days},(_,index)=>dayKeyFromIndex(start+index)),total=groups.reduce((count,group)=>count+group.rows.length,0);
 const grid=()=> <div className="sysmon-gantt-grid" aria-hidden="true">{dates.map(date=><span key={date} className={[0,6].includes(new Date(date+'T12:00:00').getDay())?'sysmon-gantt-weekend':''}/>)}</div>;
 function toggle(key){setOpened(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next;});}
 return <section aria-label="Task Gantt chart" className="sysmon-gantt"><div className="sysmon-gantt-controls"><div className="sysmon-tool-actions"><button className="sysmon-button" aria-label="Previous timeline period" onClick={()=>setStart(start-days)}><ChevronLeft size={15}/></button><strong>{formatDate(dates[0])} – {formatDate(dates.at(-1))}</strong><button className="sysmon-button" aria-label="Next timeline period" onClick={()=>setStart(start+days)}><ChevronRight size={15}/></button><button className="sysmon-button" onClick={()=>setStart(dayIndex(today)-7)}>Today</button></div><div className="sysmon-tool-actions"><label className="sysmon-field">Chart tasks<select className="sysmon-input" value={completion} onChange={event=>setCompletion(event.target.value)}><option value="all">All</option><option value="ongoing">Ongoing</option><option value="complete">Complete</option></select></label><label className="sysmon-field">Timeline range<select className="sysmon-input" value={days} onChange={event=>setDays(Number(event.target.value))}><option value={14}>14 days</option><option value={28}>28 days</option><option value={56}>56 days</option></select></label><button className="sysmon-tool-icon" aria-label="Refresh timeline" disabled={loading} onClick={refresh}><RefreshCw size={15}/></button></div></div><p className="sysmon-report-note">Scheduled tasks beyond Open/development only. Complete includes Prod live (hypercare) and Complete statuses. Scroll sideways to view every day. Expand a target date to show its task IDs and matching timeline rows. Green runs from recorded development start to the target date. If a task is still unfinished after its target, red extends from the target through today.</p>
 <div className="sysmon-gantt-legend" aria-label="Deployment timeline colors">{[['live','Through target date'],['missed','Overdue through today']].map(([key,label])=><span className={`sysmon-gantt-legend-item sysmon-gantt-state-${key}`} key={key}><span className="sysmon-gantt-legend-dot"/>{label}</span>)}</div>
 {error?<p role="alert" className="sysmon-form-error">{error}</p>:loading?<p role="status">Loading status history…</p>:<div className="sysmon-deployment-gantt-scroll" role="region" aria-label="Deployment timeline, scroll horizontally" tabIndex={0}><div className="sysmon-deployment-gantt-table" style={{'--sm-gantt-days':days,'--sm-timeline-width':`${days*40}px`}}><div className="sysmon-deployment-gantt-row sysmon-deployment-gantt-header"><div className="sysmon-deployment-gantt-label"><button className="sysmon-deployment-toggle" aria-label="For Deployment" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><ChevronRight size={14} className={expanded?'sysmon-gantt-expanded':''}/>For Deployment <span className="sysmon-count">{total}</span></button></div><div className="sysmon-deployment-days">{dates.map(date=><span key={date} className={`sysmon-gantt-day${[0,6].includes(new Date(date+'T12:00:00').getDay())?' sysmon-gantt-weekend':''}${date===today?' sysmon-gantt-today':''}`} title={date}>{date.slice(5,7)}/{date.slice(8)}</span>)}</div></div>{expanded&&groups.map(group=><section key={group.key} aria-label={`Deployment target ${group.key}`}><div className="sysmon-deployment-gantt-row sysmon-deployment-date-row"><div className="sysmon-deployment-gantt-label"><button className="sysmon-deployment-toggle" aria-label={`Deployment ${group.key}`} aria-expanded={opened.has(group.key)} aria-controls={`sysmon-deployment-rows-${group.key}`} onClick={()=>toggle(group.key)}><ChevronRight size={13} className={opened.has(group.key)?'sysmon-gantt-expanded':''}/><CalendarDays size={13}/>{formatDate(group.key)}<span className="sysmon-count">{group.rows.length}</span></button></div><div className="sysmon-deployment-date-track">{grid()}<DeploymentDateLine group={group} start={start} days={days} today={today} expanded={opened.has(group.key)} onToggle={()=>toggle(group.key)}/></div></div><div id={`sysmon-deployment-rows-${group.key}`} hidden={!opened.has(group.key)}>{group.rows.map(row=><DeploymentTaskRow key={row.task.id} row={row} start={start} days={days} today={today} grid={grid} onOpen={onOpen}/>)}</div></section>)}{expanded&&!groups.length&&<p className="sysmon-deployment-empty">No scheduled deployment tasks match these filters. Open/development tasks and tasks without target dates are hidden.</p>}</div></div>}
 </section>;
}
