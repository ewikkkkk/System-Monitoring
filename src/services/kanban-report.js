import {normalizeTaskStatus} from '../../shared/task-statuses.js';
export const kanbanColumns=[
 {key:'open',label:'Open',statuses:['OPEN']},
 {key:'ongoing-dev',label:'Ongoing dev',statuses:['ONGOING DEV','BACK TO TECH (DL)','MALFUNCTIONING (PL)']},
 {key:'ongoing-test',label:'Ongoing test',statuses:['FOR TESTING (DL)','ONGOING TEST (DL)','DEV LIVE']},
 {key:'deployment-pl',label:'For deploy',statuses:['FOR DEPLOYMENT (DL)','FOR DEPLOYMENT (PL)','READY']},
 {key:'prod-live',label:'Hypercare',statuses:['PROD LIVE (HYPERCARE)','FOR MONITORING']}
];
const dayNumber=date=>Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000;
export function buildKanbanReport(tasks,people,{person='',now=new Date(),includeComplete=false}={}){
 const scoped=[...new Map(tasks.filter(task=>!person||String(task.developerId||'')===String(person)||String(task.testerId||'')===String(person)).map(task=>[task.id,task])).values()];
 const columns=includeComplete?[{key:'complete',label:'Complete',statuses:['COMPLETE']}]:kanbanColumns.map(column=>({...column}));
 const hiddenComplete=includeComplete?0:scoped.filter(task=>normalizeTaskStatus(task.status)==='COMPLETE').length;
 const entries=scoped.filter(task=>includeComplete?normalizeTaskStatus(task.status)==='COMPLETE':normalizeTaskStatus(task.status)!=='COMPLETE').map(task=>{
  const status=normalizeTaskStatus(task.status),column=columns.find(column=>column.statuses.includes(status)),created=new Date(task.createdAt);
  return {task:{...task,status},bucket:column?.key||'unknown',age:task.createdAt&&Number.isFinite(created.getTime())&&created<=now?dayNumber(now)-dayNumber(created):null};
 });
 if(entries.some(entry=>entry.bucket==='unknown'))columns.push({key:'unknown',label:'Unknown status',statuses:[]});
 const buckets=Object.fromEntries(columns.map(column=>[column.key,entries.filter(entry=>entry.bucket===column.key).sort((a,b)=>(b.age??-1)-(a.age??-1)||a.task.id-b.task.id)]));
 const counts=Object.fromEntries(columns.map(column=>[column.key,buckets[column.key].length]));
 const pairs=new Map();
 for(const entry of entries){const task=entry.task,key=JSON.stringify([task.developerId||null,task.testerId||null]);if(!pairs.has(key))pairs.set(key,{key,developerId:task.developerId||null,testerId:task.testerId||null,developerName:task.developerName||people.find(person=>person.userId===task.developerId)?.displayName||task.developerId||'Unassigned developer',testerName:task.testerName||people.find(person=>person.userId===task.testerId)?.displayName||task.testerId||'Unassigned tester',entries:[]});pairs.get(key).entries.push(entry);}
 const rows=[...pairs.values()].sort((a,b)=>a.developerName.localeCompare(b.developerName)||a.testerName.localeCompare(b.testerName)).map(pair=>({...pair,buckets:Object.fromEntries(columns.map(column=>[column.key,buckets[column.key].filter(entry=>pair.entries.some(item=>item.task.id===entry.task.id))]))}));
 return {columns,buckets,counts,rows,total:entries.length,hiddenComplete};
}
