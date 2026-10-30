import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKanbanReport} from './kanban-report.js';
import {taskWorkflow} from '../../shared/task-statuses.js';
const people=[{userId:'dev',displayName:'Developer'},{userId:'tester',displayName:'Tester'}];
const task=(id,status,extra={})=>({id,status,createdAt:'2020-01-01T00:00:00Z',developerId:'dev',testerId:'tester',...extra});
test('five-column board maps all detailed workflow stages without duplicate cards; complete remains explicitly available',()=>{
 const tasks=taskWorkflow.map((stage,id)=>task(id+1,stage.label)),report=buildKanbanReport(tasks,people);
 assert.deepEqual(report.columns.map(column=>column.label),['Open','Ongoing dev','Ongoing test','For deploy','Hypercare']);
 assert.deepEqual(Object.values(report.counts),[1,3,3,3,2]);assert.equal(report.total,12);assert.equal(report.hiddenComplete,1);
 assert.equal(new Set(Object.values(report.buckets).flat().map(entry=>entry.task.id)).size,12);
 const complete=buildKanbanReport(tasks,people,{includeComplete:true});assert.equal(complete.total,1);assert.equal(complete.buckets.complete[0].task.status,'COMPLETE');assert.equal(complete.columns.length,1);
});
test('assignee matches either role, shared assignments appear once and duplicates/unassigned records stay accurate',()=>{
 const tasks=[task(1,'OPEN'),task(2,'Open',{testerId:'dev'}),task(3,'ONGOING DEV',{developerId:null,testerId:null}),task(4,'BACK TO TECH (DL)',{developerId:'former',testerId:null,remarks:'Back to tech: reproduce on RF'})];
 const report=buildKanbanReport([...tasks,tasks[0]],people);assert.equal(report.total,4);assert.equal(report.counts.open,2);assert.equal(report.buckets['ongoing-dev'][1].task.remarks,'Back to tech: reproduce on RF');
 const selected=buildKanbanReport(tasks,people,{person:'tester'});assert.equal(selected.total,1);assert.equal(selected.buckets.open[0].task.id,1);
});
test('legacy aliases, missing dates and unmapped statuses do not lose tasks',()=>{
 const report=buildKanbanReport([task(1,'Ready for release',{createdAt:null}),task(2,'Prod live',{completedAt:null}),task(3,'Unmapped host status')],people);
 assert.equal(report.counts['deployment-pl'],1);assert.equal(report.counts['prod-live'],1);assert.equal(report.counts.unknown,1);assert.equal(report.total,3);assert.equal(report.buckets['deployment-pl'][0].age,null);
});

test('developer and tester are paired per row while a shared tester appears beside each developer',()=>{
 const tasks=[task(1,'OPEN',{developerId:'dev1',developerName:'Dev One',testerId:'qa',testerName:'QA One'}),task(2,'ONGOING DEV',{developerId:'dev2',developerName:'Dev Two',testerId:'qa',testerName:'QA One'}),task(3,'FOR TESTING (DL)',{developerId:'dev1',developerName:'Dev One',testerId:'qa',testerName:'QA One'})];
 const report=buildKanbanReport(tasks,people);assert.equal(report.rows.length,2);assert.deepEqual(report.rows.map(row=>[row.developerName,row.testerName]),[['Dev One','QA One'],['Dev Two','QA One']]);assert.equal(report.rows[0].entries.length,2);assert.equal(report.rows[0].buckets['ongoing-test'].length,1);assert.equal(report.total,3);
});
