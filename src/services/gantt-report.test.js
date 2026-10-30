import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGanttReport,dayIndex,timelinePosition,groupDeploymentTasks,isDeploymentScheduled,deploymentGroupPosition,deploymentTaskAppearance,deploymentGroupAppearance} from './gantt-report.js';
import {validTargetDeploymentDate} from '../../shared/task-fields.js';
const now=new Date(2026,9,30,12),at=(day,hour=9)=>new Date(2026,9,day,hour).toISOString();
test('deployment planning excludes unscheduled and development tasks and groups eligible task IDs by target date',()=>{
 const tasks=[{id:1,status:'ONGOING DEV',createdAt:at(20),targetDeploymentDate:'2026-11-05'},{id:2,status:'OPEN',targetDeploymentDate:'2026-11-05'},{id:3,status:'COMPLETE',targetDeploymentDate:'2026-11-06'},{id:4,status:'FOR TESTING (DL)',createdAt:at(20)},{id:5,status:'FOR DEPLOYMENT (PL)',createdAt:at(20),targetDeploymentDate:'2026-11-05'},{id:6,status:'BACK TO TECH (DL)',targetDeploymentDate:'2026-11-05'},{id:7,status:'PROD LIVE (HYPERCARE)',createdAt:at(20),targetDeploymentDate:'2026-11-05'}];
 const groups=buildGanttReport(tasks,[{taskId:5,firstDevAt:at(21)}],{now});assert.equal(groups.length,1);assert.equal(groups[0].key,'2026-11-05');assert.deepEqual(groups[0].rows.map(row=>row.task.id),[5,7]);assert.equal(groups[0].rows[0].start,'2026-10-21');assert.equal(groups[0].rows[1].start,'');assert.match(groups[0].rows[1].issue,/not recorded/);
 const calendar=groupDeploymentTasks(tasks);assert.deepEqual(calendar[0].tasks.map(task=>task.id),[5,7]);assert.equal(groupDeploymentTasks(tasks,{includeComplete:true}).length,2);
 assert.equal(isDeploymentScheduled({status:'READY',targetDeploymentDate:'2026-02-30'}),false);
});

test('timeline clips bars to the displayed range, retains target markers and flags backwards plans',()=>{
 const windowStart=dayIndex('2026-10-20'),position=timelinePosition({start:'2026-10-18',end:'2026-10-22',target:'2026-10-22'},windowStart,10);
 assert.equal(position.left,0);assert.equal(position.width,30);assert.equal(position.target,25);
 assert.equal(timelinePosition({start:'',end:'2026-10-22',target:'2026-10-22'},windowStart,10).width,0);
 assert.equal(timelinePosition({start:'2026-11-01',end:'2026-11-05',target:'2026-11-05'},windowStart,10).width,0);
 const groups=buildGanttReport([{id:1,status:'FOR TESTING (DL)',createdAt:at(20),targetDeploymentDate:'2026-10-21'}],[{taskId:1,firstDevAt:at(22)}],{now});assert.match(groups[0].rows[0].issue,/precedes/);
});
test('target dates validate real calendar dates and allow explicit clearing or omission',()=>{
 for(const value of [undefined,null,'','2028-02-29','2026-11-05'])assert.equal(validTargetDeploymentDate(value),true);
 for(const value of ['2026-02-29','2026-02-30','0001-01-01','2026-11-05T10:00:00Z',123,'bad'])assert.equal(validTargetDeploymentDate(value),false);
});

test('chart completion filters separate live/complete from ongoing without including unplanned tasks',()=>{
 const tasks=['FOR TESTING (DL)','PROD LIVE (HYPERCARE)','COMPLETE','OPEN'].map((status,index)=>({id:index+1,status,targetDeploymentDate:'2026-11-05'}));
 tasks.push({id:5,status:'COMPLETE'});
 const ids=completion=>buildGanttReport(tasks,[],{now,completion}).flatMap(group=>group.rows.map(row=>row.task.id));
 assert.deepEqual(ids('all'),[1,2,3]);assert.deepEqual(ids('ongoing'),[1]);assert.deepEqual(ids('complete'),[2,3]);
});

test('group lines stop at the target day center and retain accurate alignment when zoomed or clipped',()=>{
 const group={key:'2026-11-05',rows:[{start:'2026-10-25',issue:''},{start:'2026-10-20',issue:''},{start:'2026-10-01',issue:'Target precedes development start'}]},start=dayIndex('2026-10-23');
 for(const days of [14,28,56]){
  const position=deploymentGroupPosition(group,start,days);
  assert.equal(position.left,0);assert.equal(position.width,13.5/days*100);assert.equal(position.target,13.5/days*100);assert.equal(position.outside,'');
 }
 const visibleStart=deploymentGroupPosition({...group,rows:[{start:'2026-10-25',issue:''}]},start,28);
 assert.equal(visibleStart.left,2/28*100);assert.equal(visibleStart.width,11.5/28*100);
 const before=deploymentGroupPosition(group,dayIndex('2026-11-06'),14);assert.equal(before.width,0);assert.equal(before.target,null);assert.match(before.outside,/before/);
 const after=deploymentGroupPosition(group,dayIndex('2026-10-01'),14);assert.equal(after.width,0);assert.equal(after.target,null);assert.match(after.outside,/after/);
 const clipped=deploymentGroupPosition({...group,rows:[{start:'2026-10-01',issue:''}]},dayIndex('2026-10-01'),14);assert.equal(clipped.width,100);assert.equal(clipped.target,null);
 const missing=deploymentGroupPosition({...group,rows:[{start:'',issue:'Ongoing dev start not recorded'}]},start,28);assert.equal(missing.width,0);assert.equal(missing.target,13.5/28*100);
});

test('missed deployment is red only after the target day while unfinished; task status drives other colors',()=>{
 const task={status:'FOR DEPLOYMENT (PL)',targetDeploymentDate:'2026-10-29'},today='2026-10-30';
 assert.equal(deploymentTaskAppearance(task,today).key,'missed');
 assert.equal(deploymentTaskAppearance({...task,targetDeploymentDate:today},today).key,'deployment');
 assert.equal(deploymentTaskAppearance({...task,targetDeploymentDate:'2026-10-31'},today).key,'deployment');
 for(const status of ['PROD LIVE (HYPERCARE)','COMPLETE','Closed','Prod live'])assert.equal(deploymentTaskAppearance({...task,status},today).key,'live');
 for(const [status,key] of [['FOR TESTING (DL)','testing'],['FOR MONITORING','monitoring'],['ONGOING DEV','development']])assert.equal(deploymentTaskAppearance({...task,status,targetDeploymentDate:'2026-11-05'},today).key,key);
 assert.equal(deploymentTaskAppearance({...task,targetDeploymentDate:null},today).missed,false);
 const rows=[{task:{...task,status:'COMPLETE'}},{task:{...task,status:'FOR TESTING (DL)',targetDeploymentDate:'2026-11-05'}},{task}];
 const mixed=deploymentGroupAppearance({rows},today);assert.equal(mixed.key,'missed');assert.equal(mixed.missedCount,1);assert.match(mixed.description,/COMPLETE: 1/);
 assert.equal(deploymentGroupAppearance({rows:rows.slice(0,2)},today).key,'testing');
});
