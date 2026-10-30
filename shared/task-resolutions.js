import { isCompletedStatus } from './task-statuses.js';
// Count transitions into the completed group, not repeated edits or Prod live -> Closed.
export function taskResolutions(history) {
  const sorted = history.filter(entry => Number.isFinite(Date.parse(entry.changedAt))).slice().sort((a,b)=>a.taskId-b.taskId || Date.parse(a.changedAt)-Date.parse(b.changedAt) || a.id-b.id);
  const previous = new Map(), result = [];
  for (const entry of sorted) {
    const complete = isCompletedStatus(entry.status);
    if (complete && !previous.get(entry.taskId)) result.push({ id:entry.id, taskId:entry.taskId, occurredAt:entry.changedAt, status:entry.status, actorId:entry.actorId });
    previous.set(entry.taskId,complete);
  }
  return result;
}
