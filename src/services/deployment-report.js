import { formatTaskNumber } from '../../shared/task-number.js';
export const localDayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function buildDeploymentReport(dateKey, events, { demo = false } = {}) {
  const date = new Date(dateKey + 'T12:00:00');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rows = events.filter(event => localDayKey(new Date(event.occurredAt)) === dateKey)
    .sort((a,b) => new Date(a.occurredAt) - new Date(b.occurredAt) || a.id - b.id);
  const count = action => rows.filter(event => event.action === action).length;
  const lines = [
    'WMS PRODUCTION DEPLOYMENT SUMMARY',
    `Date: ${new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date)}`,
    `Time zone: ${timezone}`,
    ...(demo ? ['DEMO DATA — sample/local records, not a real production release report.'] : []),
    '', `Events: ${rows.length} | Deployments: ${count('Deployment')} | Fixes: ${count('Fix')} | Reverts: ${count('Revert')}`,
    `Concerns: ${new Set(rows.map(event => event.taskId)).size} unique tasks | Enhancement events: ${rows.filter(event => event.type === 'Enhancement').length} | Bug events: ${rows.filter(event => event.type === 'Bug').length}`,
    ''
  ];
  if (!rows.length) lines.push('No production deployments, fixes, or reverts recorded for this date.');
  for (const event of rows) {
    const reference = formatTaskNumber(event);
    lines.push(`#${event.id} · ${event.action} · ${new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(event.occurredAt))}`,
      `Task: ${reference} — ${event.title || 'Untitled task'}`,
      `IT Help Desk ticket: ${event.reference || 'Not linked'}`,
      `Type: ${event.type || 'Not specified'} | System: ${event.system || 'Not specified'}`,
      `${event.action === 'Revert' ? 'Restored version' : 'Version / release'}: ${event.version}`);
    if (event.revertsId) {
      const original = events.find(item => item.id === event.revertsId);
      lines.push(`Reverts: event #${event.revertsId}${original ? ` (${original.version}, ${new Intl.DateTimeFormat('en', { dateStyle:'medium', timeStyle:'short' }).format(new Date(original.occurredAt))})` : ''}`);
    }
    if (event.action !== 'Revert') {
      const revert = events.find(item => item.revertsId === event.id);
      if (revert) lines.push(`Revert recorded: event #${revert.id} at ${new Intl.DateTimeFormat('en', {dateStyle:'medium',timeStyle:'short'}).format(new Date(revert.occurredAt))}`);
    }
    lines.push(`Notes: ${event.notes}`, `Logged by: ${event.actorId}`, '');
  }
  lines.push('Reference log only. Recording an event does not execute a deployment or rollback.');
  return lines.join('\n');
}
