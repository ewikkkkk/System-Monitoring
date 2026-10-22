import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBugTrend, compareDeployment } from './bug-trends.js';
import { localDayKey } from './deployment-report.js';
import { listTasksForStatus, parseRelatedTickets, validRelatedTickets } from '../../shared/related-tickets.js';
import { taskResolutions } from '../../shared/task-resolutions.js';
import { taskSystems, validTaskSystem } from '../../shared/task-fields.js';

test('status list defaults to pending and explicitly includes completed states; related references remain distinct',()=>{
  const tasks=['Open','Prod live','Closed'].map((status,id)=>({status,id}));
  assert.deepEqual(listTasksForStatus(tasks,'').map(task=>task.status),['Open']);
  assert.deepEqual(listTasksForStatus(tasks,'Closed').map(task=>task.status),['Closed']);
  assert.deepEqual(listTasksForStatus(tasks,'Prod live').map(task=>task.status),['Prod live']);
  assert.deepEqual(parseRelatedTickets('HD-1,HD-2\n HD-1'),['HD-1','HD-2']);
  assert.equal(validRelatedTickets(['HD-1']),true);
  assert.equal(validRelatedTickets(Array(21).fill('HD-1')),false);
});

test('daily chart separates creations and recurrences, preserves zero days and excludes future/unknown/enhancement reports',()=>{
  const now=new Date(2026,9,22,12),today=localDayKey(now);
  const tasks=[{id:1,type:'Bug',system:'WMS',createdAt:new Date(2026,9,21,8).toISOString()}, {id:2,type:'Enhancement',system:'WMS',createdAt:now.toISOString()}, {id:3,type:'Bug',system:'Other',createdAt:now.toISOString()}];
  const occurrences=[{id:1,taskId:1,occurredAt:now.toISOString()}, {id:1,taskId:1,occurredAt:now.toISOString()}, {id:2,taskId:2,occurredAt:now.toISOString()}, {id:3,taskId:999,occurredAt:now.toISOString()}, {id:4,taskId:1,occurredAt:new Date(2026,9,23).toISOString()}];
  const deployments=[{id:1,system:'WMS',occurredAt:now.toISOString()},{id:2,system:'Other',occurredAt:now.toISOString()}];
  const result=buildBugTrend(tasks,occurrences,deployments,{now,days:7,system:'WMS'});
  assert.equal(result.rows.length,7);assert.equal(result.total,2);assert.equal(result.newBugs,1);assert.equal(result.recurrences,1);
  assert.equal(result.rows.find(row=>row.key===today).releases.length,1);
  assert.equal(result.rows[0].entries.length,0);
  assert.equal(buildBugTrend([],[],deployments,{now,days:7}).total,0);
});

test('deployment comparison uses exact boundaries, same system and flags incomplete after-window',()=>{
  const at=Date.parse('2026-10-15T12:00:00Z'),week=7*24*3600000,deployment={id:7,system:'WMS',occurredAt:new Date(at).toISOString()};
  const event=(offset,system='WMS',deploymentId=null)=>({at:new Date(at+offset).toISOString(),task:{system},deploymentId});
  const events=[event(-week),event(-1),event(0),event(1000,'WMS',7),event(2000,'Other',7),event(week),event(-week-1),event(2*week)];
  assert.deepEqual(compareDeployment(events,deployment,new Date(at+week)),{before:2,after:2,linked:1,partial:false});
  assert.deepEqual(compareDeployment(events,deployment,new Date(at+500)),{before:2,after:1,linked:0,partial:true});
});

test('resolutions retain reopen history, deduplicate completed edits and count pending tasks across all dates',()=>{
  const stamp=(day,hour)=>new Date(2026,9,day,hour).toISOString(),now=new Date(2026,9,22,15);
  const history=[
    {id:1,taskId:1,status:'Open',changedAt:stamp(21,8)},
    {id:2,taskId:1,status:'Prod live',changedAt:stamp(21,10)},
    {id:3,taskId:1,status:'Closed',changedAt:stamp(21,11)},
    {id:4,taskId:1,status:'Closed',changedAt:stamp(21,12)},
    {id:5,taskId:1,status:'Open',changedAt:stamp(22,8)},
    {id:6,taskId:1,status:'Closed',changedAt:stamp(22,10)},
    {id:7,taskId:1,status:'Open',changedAt:stamp(22,11)},
    {id:8,taskId:2,status:'Closed',changedAt:stamp(22,12)},
    {id:9,taskId:2,status:'Closed',changedAt:stamp(22,13)}
  ];
  const resolutions=taskResolutions(history);
  assert.deepEqual(resolutions.map(event=>event.id),[2,6,8]);
  const old='2026-01-01T00:00:00Z';
  const tasks=[{id:1,type:'Bug',system:'WMS',status:'Open',createdAt:old,completedAt:null},
    {id:2,type:'Enhancement',system:'WMS',status:'Closed',createdAt:old,completedAt:stamp(20,12)},
    {id:3,type:'Bug',system:'WMS',status:'In testing',createdAt:old},
    {id:4,type:'Enhancement',system:'WMS',status:'Ready for release',createdAt:old},
    {id:5,type:'Enhancement',system:'WMS',status:'Prod live',createdAt:old,completedAt:stamp(22,14)}];
  const trend=buildBugTrend(tasks,[],[],{now,days:7,resolutions:[...resolutions,{...resolutions[1],id:999}, {id:1000,taskId:1,occurredAt:stamp(23,12)}]});
  assert.equal(trend.resolvedBugs,2);assert.equal(trend.resolvedEnhancements,2);
  const today=trend.rows.find(row=>row.key===localDayKey(now));
  assert.equal(today.resolved.length,3);assert.equal(today.resolvedBugs,1);assert.equal(today.resolvedEnhancements,2);
  assert.equal(trend.rows.find(row=>row.key===localDayKey(new Date(2026,9,20))).resolved.length,0);
  assert.equal(trend.pendingBugs,2);assert.equal(trend.pendingEnhancements,1);assert.equal(trend.newBugs,0);
});

test('new task systems are fixed while unchanged legacy values remain editable',()=>{
  assert.deepEqual(taskSystems,['WMS','Client Portal','RF Barcoding','PISA','CMMS','TOLL']);
  assert.equal(validTaskSystem('Other'),false);assert.equal(validTaskSystem('Other','Other'),true);
  assert.equal(validTaskSystem('Wrong','Other'),false);assert.equal(validTaskSystem('WMS','Other'),true);
});
