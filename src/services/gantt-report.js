import {normalizeTaskStatus,isCompletedStatus} from '../../shared/task-statuses.js';
import {validTargetDeploymentDate} from '../../shared/task-fields.js';
import {localDayKey} from './deployment-report.js';
export const dateKey=value=>value?String(value).slice(0,10):'';
export const dayIndex=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))?Math.floor(Date.parse(value+'T00:00:00Z')/86400000):null;
export const dayKeyFromIndex=index=>new Date(index*86400000).toISOString().slice(0,10);
const deploymentStatuses=['FOR TESTING (DL)','ONGOING TEST (DL)','DEV LIVE','READY','FOR DEPLOYMENT (DL)','FOR DEPLOYMENT (PL)','FOR MONITORING','PROD LIVE (HYPERCARE)'];
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
