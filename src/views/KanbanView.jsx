import React,{useEffect,useState} from 'react';
import {Bug,Sparkles,CalendarDays,Users,Ticket,MessageSquare} from 'lucide-react';
import {taskReference,formatDate} from '../task-utils.js';
import {buildKanbanReport} from '../services/kanban-report.js';
function Card({entry,onOpen}){
 const {task,age}=entry;
 return <button className="sysmon-age-card sysmon-stage-card" aria-haspopup="dialog" aria-label={`Open ${taskReference(task)}: ${task.title}`} onClick={()=>onOpen(task)}>
  <span className="sysmon-age-card-top"><span className="sysmon-task-ref">{task.type==='Bug'?<Bug size={13}/>:<Sparkles size={13}/>} {taskReference(task)}</span><span className="sysmon-age-chip">{age==null?'Date unavailable':`${age}d old`}</span></span>
  <strong className="sysmon-age-card-title">{task.title}</strong><span className="sysmon-age-card-context">{task.system||'System not specified'}{task.moduleName?` · ${task.moduleName}`:''}</span>
  <span className="sysmon-stage-status">{task.status}</span>
  {task.remarks&&<span className="sysmon-stage-remarks" title={task.remarks}><MessageSquare size={12}/><span>{task.remarks}</span></span>}
  <span className="sysmon-age-card-meta"><Users size={12}/>{task.developerName||task.developerId||'No developer'} · {task.testerName||task.testerId||'No tester'}</span>
  <span className={`sysmon-priority sysmon-priority-${task.priority?.toLowerCase()}`}>{task.priority}</span>
  {task.reference&&<span className="sysmon-age-card-meta"><Ticket size={12}/>{task.reference}</span>}{task.targetDeploymentDate&&<span className="sysmon-age-card-meta"><CalendarDays size={12}/>Target {formatDate(task.targetDeploymentDate)}</span>}
 </button>;
}
function Column({column,entries,onOpen}){
 const [expanded,setExpanded]=useState(false);useEffect(()=>setExpanded(false),[entries.map(entry=>entry.task.id).join(',')]);
 return <section className={`sysmon-stage-column sysmon-age-${column.key}`} aria-label={column.label}><div className="sysmon-stage-heading"><span className="sysmon-stage-dot"/><span>{column.label}</span><span className="sysmon-count">{entries.length}</span></div><div className="sysmon-stage-items">{(expanded?entries:entries.slice(0,8)).map(entry=><Card key={entry.task.id} entry={entry} onOpen={onOpen}/>)}{!entries.length&&<span className="sysmon-stage-empty">No assigned tasks</span>}{entries.length>8&&<button className="sysmon-age-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Show less':`Show ${entries.length-8} more`}</button>}</div></section>;
}
export default function KanbanView({tasks,people,person,status,onSelectStatus,onOpen}){
 const [now,setNow]=useState(()=>new Date());useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
 const report=buildKanbanReport(tasks,people,{person,now,includeComplete:status==='COMPLETE'});
 return <section className="sysmon-kanban-view" aria-label="My assigned task Kanban board"><div className="sysmon-stage-note"><p className="sysmon-report-note">My assigned tasks &middot; {report.total} {report.total===1?'task':'tasks'} &middot; Assigned to your account as developer or tester.</p>{report.hiddenComplete>0&&<button className="sysmon-tool-text" onClick={()=>onSelectStatus('COMPLETE')}>View complete ({report.hiddenComplete})</button>}</div><div className="sysmon-stage-board" style={{'--sm-stage-columns':report.columns.length}}>{report.columns.map(column=><Column key={column.key} column={column} entries={report.buckets[column.key]} onOpen={onOpen}/>)}</div>{!report.total&&<p className="sysmon-muted">No tasks assigned to your account match these filters.</p>}</section>;
}
