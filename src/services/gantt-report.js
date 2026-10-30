import {normalizeTaskStatus,isCompletedStatus} from '../../shared/task-statuses.js';
import {validTargetDeploymentDate} from '../../shared/task-fields.js';
import {localDayKey} from './deployment-report.js';
export const dateKey=value=>value?String(value).slice(0,10):'';
export const dayIndex=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))?Math.floor(Date.parse(value+'T00:00:00Z')/86400000):null;
export const dayKeyFromIndex=index=>new Date(index*86400000).toISOString().slice(0,10);
const deploymentStatuses=['FOR TESTING (DL)','ONGOING TEST (DL)','DEV LIVE','READY','FOR DEPLOYMENT (DL)','FOR DEPLOYMENT (PL)','FOR MONITORING','PROD LIVE (HYPERCARE)'];
export const deploymentLegend=[['testing','Testing'],['deployment','For deployment'],['monitoring','Monitoring'],['live','Prod live / Complete'],['missed','Missed deployment']];
export function deploymentTaskAppearance(task,today=localDayKey(new Date())){
 const status=normalizeTaskStatus(task.status),target=dateKey(task.targetDeploymentDate);
 const missed=!!target&&validTargetDeploymentDate(target)&&target<today&&!isCompletedStatus(status);
 let key='open',label='Open',rank=1;
 if(['ONGOING DEV','BACK TO TECH (DL)','MALFUNCTIONING (PL)'].includes(status)){key='development';label='Development';rank=2;}
 if(['FOR TESTING (DL)','ONGOING TEST (DL)','DEV LIVE'].includes(status)){key='testing';label='Testing';rank=3;}
 if(['READY','FOR DEPLOYMENT (DL)','FOR DEPLOYMENT (PL)'].includes(status)){key='deployment';label='For deployment';rank=4;}
 if(status==='FOR MONITORING'){key='monitoring';label='Monitoring';rank=5;}
 if(isCompletedStatus(status)){key='live';label=status==='COMPLETE'?'Complete':'Prod live';rank=6;}
 return missed?{key:'missed',label:'Missed deployment',rank:0,missed:true,status}:{key,label,rank,missed:false,status};
}
export function deploymentGroupAppearance(group,today){
 const entries=group.rows.map(row=>deploymentTaskAppearance(row.task,today));
 const first=[...entries].sort((a,b)=>a.rank-b.rank)[0]||{key:'open',label:'Open'};
 const counts=new Map();for(const entry of entries)counts.set(entry.status,(counts.get(entry.status)||0)+1);
 return {...first,description:[...counts].map(([status,count])=>`${status}: ${count}`).join('; '),missedCount:entries.filter(entry=>entry.missed).length};
}
export function isDeploymentScheduled(task,{includeComplete=false}={}){
 const target=dateKey(task.targetDeploymentDate),status=normalizeTaskStatus(task.status);
 return !!target&&validTargetDeploymentDate(target)&&(deploymentStatuses.includes(status)||(includeComplete&&status==='COMPLETE'));
}
export function groupDeploymentTasks(tasks,options={}){
 const groups=new Map();for(const task of tasks){if(!isDeploymentScheduled(task,options))continue;const key=dateKey(task.targetDeploymentDate);if(!groups.has(key))groups.set(key,{key,label:key,tasks:[]});groups.get(key).tasks.push(task);}
 return [...groups.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(group=>({...group,tasks:group.tasks.sort((a,b)=>a.id-b.id)}));
}
export function buildGanttReport(tasks,timeline,{now=new Date(),includeComplete=false,completion}={}){
 const starts=new Map(timeline.map(row=>[row.taskId,row.firstDevAt]));
 const visible=tasks.filter(task=>!completion||completion==='all'||(completion==='complete'?isCompletedStatus(task.status):!isCompletedStatus(task.status)));
 return groupDeploymentTasks(visible,{includeComplete:completion?completion!=='ongoing':includeComplete}).map(group=>({...group,rows:group.tasks.map(task=>{
  const raw=starts.get(task.id),date=raw?new Date(raw):null,created=task.createdAt?new Date(task.createdAt):null;
  const start=date&&Number.isFinite(date.getTime())&&date<=now&&(!created||!Number.isFinite(created.getTime())||date>=created)?localDayKey(date):'';
  const target=dateKey(task.targetDeploymentDate),issue=!start?'Ongoing dev start not recorded':dayIndex(target)<dayIndex(start)?'Target precedes development start':'';
  return {task,start,target,end:target,issue,endLabel:'Target deployment'};
 }).sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999')||a.task.id-b.task.id)}));
}
export function timelinePosition(row,windowStart,days){
 const from=dayIndex(row.start),to=dayIndex(row.end),target=dayIndex(row.target);
 return {left:from==null?null:Math.max(0,(from-windowStart)/days*100),width:from==null||to==null||to<from||to<windowStart||from>=windowStart+days?0:Math.max(0,(Math.min(to+1,windowStart+days)-Math.max(from,windowStart))/days*100),target:target!=null&&target>=windowStart&&target<windowStart+days?(target-windowStart+.5)/days*100:null};
}
export function deploymentGroupPosition(group,windowStart,days){
 const starts=group.rows.filter(row=>!row.issue&&dayIndex(row.start)!=null).map(row=>dayIndex(row.start));
 const target=dayIndex(group.key),from=starts.length?Math.min(...starts):null;
 const right=target==null?null:target+.5;
 return {left:from==null?0:Math.max(0,(from-windowStart)/days*100),
  width:from==null||right==null||right<from?0:Math.max(0,(Math.min(right,windowStart+days)-Math.max(from,windowStart))/days*100),
  target:target!=null&&target>=windowStart&&target<windowStart+days?(target-windowStart+.5)/days*100:null,
  outside:target==null?'':target<windowStart?'Target before displayed range':target>=windowStart+days?'Target after displayed range':''};
}
