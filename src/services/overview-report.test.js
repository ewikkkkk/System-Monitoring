import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewReport } from './overview-report.js';

const now = new Date(2026, 9, 22, 12);
test('report excludes completed work from overdue and backlog and avoids duplicate person assignments', () => {
  const report = buildOverviewReport([
    { id: 1, type: 'Bug', status: 'In testing', priority: 'High', developerId: 'a', testerId: 'a', system: 'WMS', dueDate: '2026-10-21', estimateHours: 4 },
    { id: 2, type: 'Enhancement', status: 'Closed', priority: 'Urgent', system: 'WMS', dueDate: '2026-10-20', estimateHours: 20, createdAt: '2026-10-19T00:00:00Z', completedAt: '2026-10-21T00:00:00Z' },
    { id: 3, type: 'Enhancement', status: 'Open', priority: 'Normal', system: '', dueDate: '2026-10-29', estimateHours: null }
  ], [{ userId: 'a', displayName: 'Developer Tester', assignmentRole: 'both' }], now);
  assert.equal(report.summary.active, 2);
  assert.equal(report.summary.completed, 1);
  assert.equal(report.summary.overdue, 1);
  assert.equal(report.summary.hours, 4);
  assert.equal(report.summary.completionRate, 33);
  assert.equal(report.workload[0].active, 1);
  assert.equal(report.workload[0].developer, 1);
  assert.equal(report.workload[0].tester, 1);
  assert.equal(report.workload[0].hours, 4);
  assert.deepEqual(report.dueSoon.map(t => t.id), [3]);
  assert.equal(report.missingEstimate, 1);
  assert.equal(report.averageCompletionDays, 2);
  assert.equal(report.completedThisWeek, 1);
  assert.equal(report.priorities.find(p => p.priority === 'Urgent').total, 0);
  assert.equal(report.systems.find(s => s.system === 'Not specified').active, 1);
});

test('empty report has no fabricated rate or completion duration', () => {
  const report = buildOverviewReport([], [], now);
  assert.equal(report.summary.total, 0);
  assert.equal(report.summary.completionRate, null);
  assert.equal(report.averageCompletionDays, null);
  assert.equal(report.attention.length, 0);
  assert.ok(report.statuses.every(s => s.total === 0));
});

test('due date boundaries include today and day seven and ignore undated or completed work', () => {
  const tasks = ['2026-10-21','2026-10-22','2026-10-29','2026-10-30',null].map((dueDate, id) => ({ id, dueDate, type: 'Bug', status: 'Open' }));
  tasks.push({ id: 8, dueDate: '2026-10-22', type: 'Bug', status: 'Prod live' });
  const report = buildOverviewReport(tasks, [], now);
  assert.deepEqual(report.dueSoon.map(t => t.id), [1, 2]);
  assert.deepEqual(report.overdue.map(t => t.id), [0]);
});
