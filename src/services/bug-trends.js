import { isCompletedStatus } from '../../shared/task-statuses.js';
import { localDayKey } from './deployment-report.js';

export function buildBugTrend(tasks, occurrences, deployments, { days = 30, now = new Date(), system = '', resolutions = [] } = {}) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - days + 1);
  const scoped = tasks.filter(task => !system || (task.system || '') === system);
  const byId = new Map(scoped.map(task=>[task.id,task]));
  const isComplete = task => isCompletedStatus(task.status);
  const resolved = resolutions.filter(event=>byId.has(event.taskId) && Number.isFinite(Date.parse(event.occurredAt)) && Date.parse(event.occurredAt)<=now.getTime()).map(event=>({...event,task:byId.get(event.taskId),source:'history'}));
  const withHistory = new Set(resolved.map(event=>event.taskId));
  for (const task of scoped) {
    if (isComplete(task) && !withHistory.has(task.id) && Number.isFinite(Date.parse(task.completedAt)) && Date.parse(task.completedAt)<=now.getTime())
      resolved.push({id:`snapshot-${task.id}`,taskId:task.id,task,occurredAt:task.completedAt,source:'completion date'});
  }
  const bugs = new Map(scoped.filter(task => task.type === 'Bug').map(task => [task.id, task]));
  const systems = new Set(scoped.map(task => task.system || ''));
  const events = [...bugs.values()].map(task => ({ key:`new-${task.id}`, kind:'New bug', task, at:task.createdAt, reference:task.reference || '', notes:'' }));
  const seen = new Set();
  for (const occurrence of occurrences) {
    if (!bugs.has(occurrence.taskId) || seen.has(occurrence.id)) continue;
    seen.add(occurrence.id);
    events.push({ key:`recurrence-${occurrence.id}`, kind:'Recurrence', task:bugs.get(occurrence.taskId), at:occurrence.occurredAt, reference:occurrence.reference, notes:occurrence.notes, deploymentId:occurrence.deploymentId });
  }
  const validEvents = events.filter(event => Number.isFinite(Date.parse(event.at)) && Date.parse(event.at) <= now.getTime());
  const releases = deployments.filter(event => systems.has(event.system || '') && Number.isFinite(Date.parse(event.occurredAt)) && Date.parse(event.occurredAt) <= now.getTime());
  const rows = [];
  for (let index = 0; index < days; index++) {
    const date = new Date(start); date.setDate(start.getDate() + index);
    const key = localDayKey(date);
    const entries = validEvents.filter(event => localDayKey(new Date(event.at)) === key).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const resolvedOnDay = [...new Map(resolved.filter(event=>localDayKey(new Date(event.occurredAt))===key).map(event=>[event.taskId,event])).values()];
    rows.push({ key, date, newBugs:entries.filter(event=>event.kind==='New bug').length, recurrences:entries.filter(event=>event.kind==='Recurrence').length, entries, resolved:resolvedOnDay,
      resolvedBugs:resolvedOnDay.filter(event=>event.task.type==='Bug').length,resolvedEnhancements:resolvedOnDay.filter(event=>event.task.type==='Enhancement').length,
      releases:releases.filter(event=>localDayKey(new Date(event.occurredAt))===key).sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)) });
  }
  return { rows, events:validEvents, releases, total:rows.reduce((sum,row)=>sum+row.entries.length,0), newBugs:rows.reduce((sum,row)=>sum+row.newBugs,0), recurrences:rows.reduce((sum,row)=>sum+row.recurrences,0),
    resolvedBugs:rows.reduce((sum,row)=>sum+row.resolvedBugs,0),resolvedEnhancements:rows.reduce((sum,row)=>sum+row.resolvedEnhancements,0),
    pendingBugs:scoped.filter(task=>task.type==='Bug'&&!isComplete(task)).length,pendingEnhancements:scoped.filter(task=>task.type==='Enhancement'&&!isComplete(task)).length };
}

export function compareDeployment(events, deployment, now = new Date()) {
  events = events.filter(event=>(event.task.system || '')===(deployment.system || ''));
  const at = Date.parse(deployment.occurredAt), week = 7 * 24 * 60 * 60 * 1000;
  const before = events.filter(event=>Date.parse(event.at)>=at-week && Date.parse(event.at)<at);
  const after = events.filter(event=>Date.parse(event.at)>=at && Date.parse(event.at)<at+week && Date.parse(event.at)<=now.getTime());
  return { before:before.length, after:after.length, linked:after.filter(event=>event.deploymentId===deployment.id).length, partial:now.getTime()<at+week };
}
