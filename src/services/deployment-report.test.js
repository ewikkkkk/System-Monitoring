import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeploymentReport, localDayKey } from './deployment-report.js';

test('daily report counts only selected local date and retains cross-day revert reference', () => {
  const original = { id:1, taskId:10, reference:'T-155441', action:'Deployment', occurredAt:new Date(2026,9,21,23,0).toISOString(), version:'v1', notes:'Deployed', title:'Enhancement A', type:'Enhancement', actorId:'host-user' };
  const revert = { ...original, id:2, action:'Revert', occurredAt:new Date(2026,9,22,1,0).toISOString(), revertsId:1, version:'v0', notes:'Rollback due to regression' };
  const fix = { ...original, id:3, taskId:11, action:'Fix', occurredAt:new Date(2026,9,22,9,0).toISOString(), title:'Bug B', type:'Bug', notes:'Corrected stock total', version:'v2' };
  const report = buildDeploymentReport('2026-10-22', [fix,original,revert], {demo:true});
  assert.match(report,/Events: 2 \| Deployments: 0 \| Fixes: 1 \| Reverts: 1/);
  assert.match(report,/Concerns: 2 unique tasks/);
  assert.match(report,/Reverts: event #1 \(v1,/);
  assert.match(report,/DEMO DATA/);
  assert.ok(report.indexOf('#2 · Revert') < report.indexOf('#3 · Fix'));
  assert.ok(!report.includes('#1 · Deployment'));
  assert.match(report,/Corrected stock total/);
  assert.match(report,/Task: ENH-0010/);
  assert.match(report,/Task: BUG-0011/);
  assert.match(report,/IT Help Desk ticket: T-155441/);
  assert.equal(localDayKey(new Date(2026,9,22,0,1)),'2026-10-22');
});

test('empty date report states no recorded events without inventing releases', () => {
  const report=buildDeploymentReport('2026-10-20',[]);
  assert.match(report,/Events: 0/);
  assert.match(report,/No production deployments, fixes, or reverts recorded/);
  assert.ok(!report.includes('DEMO DATA'));
});
