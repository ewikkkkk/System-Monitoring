import { normalizeTaskStatus, isTestingStatus } from '../../shared/task-statuses.js';
import { isComplete, statuses } from '../task-utils.js';

const dateOnly = value => value ? String(value).slice(0, 10) : null;
const sumHours = tasks => tasks.reduce((sum, task) => sum + (Number(task.estimateHours) || 0), 0);
export function buildOverviewReport(tasks, people, now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const lastDay = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
  const recently = value => value && new Date(value) >= weekStart && new Date(value) <= now;
  const active = tasks.filter(t => !isComplete(t));
  const completed = tasks.filter(isComplete);
  const overdue = t => !isComplete(t) && dateOnly(t.targetDeploymentDate) && dateOnly(t.targetDeploymentDate) < today;
  const upcomingDeployments = t => !isComplete(t) && dateOnly(t.targetDeploymentDate) >= today && dateOnly(t.targetDeploymentDate) <= lastDay;
  const summarize = set => ({ total: set.length, active: set.filter(t => !isComplete(t)).length,
    completed: set.filter(isComplete).length, overdue: set.filter(overdue).length,
    testing: set.filter(t => isTestingStatus(t.status)).length, hours: sumHours(set.filter(t => !isComplete(t))),
    completionRate: set.length ? Math.round(set.filter(isComplete).length / set.length * 100) : null });
  const durations = completed.filter(t => t.createdAt && t.completedAt)
    .map(t => (new Date(t.completedAt) - new Date(t.createdAt)) / 86400000).filter(days => Number.isFinite(days) && days >= 0);
  return {
    summary: summarize(tasks),
    types: ['Enhancement', 'Bug'].map(type => ({ type, ...summarize(tasks.filter(t => t.type === type)) })),
    statuses: statuses.map(status => ({ status, enhancement: tasks.filter(t => normalizeTaskStatus(t.status) === status && t.type === 'Enhancement').length,
      bug: tasks.filter(t => normalizeTaskStatus(t.status) === status && t.type === 'Bug').length, total: tasks.filter(t => normalizeTaskStatus(t.status) === status).length })),
    priorities: ['Urgent', 'High', 'Normal', 'Low'].map(priority => ({ priority,
      enhancement: active.filter(t => t.priority === priority && t.type === 'Enhancement').length,
      bug: active.filter(t => t.priority === priority && t.type === 'Bug').length,
      total: active.filter(t => t.priority === priority).length })),
    workload: people.map(person => {
      const assigned = active.filter(t => t.developerId === person.userId || t.testerId === person.userId);
      return { ...person, active: assigned.length, developer: active.filter(t => t.developerId === person.userId).length,
        tester: active.filter(t => t.testerId === person.userId).length, overdue: assigned.filter(overdue).length, hours: sumHours(assigned) };
    }).sort((a,b) => b.active - a.active || a.displayName.localeCompare(b.displayName)),
    systems: [...new Set(tasks.map(t => t.system?.trim() || 'Not specified'))].sort().map(system => {
      const set = tasks.filter(t => (t.system?.trim() || 'Not specified') === system);
      return { system, ...summarize(set), enhancement: set.filter(t => t.type === 'Enhancement').length, bug: set.filter(t => t.type === 'Bug').length };
    }),
    attention: active.map(task => ({ task, reasons: [
      overdue(task) && 'Overdue', ['Urgent','High'].includes(task.priority) && `${task.priority} priority`,
      !task.developerId && 'No developer', !task.testerId && 'No tester', !task.targetDeploymentDate && 'No target deployment date',
      task.estimateHours == null && 'No estimate'
    ].filter(Boolean) })).filter(item => item.reasons.length).sort((a,b) => Number(overdue(b.task)) - Number(overdue(a.task)) || b.reasons.length - a.reasons.length),
    overdue: active.filter(overdue), upcomingDeployments: active.filter(upcomingDeployments),
    missingDeveloper: active.filter(t => !t.developerId).length, missingTester: active.filter(t => !t.testerId).length,
    missingTargetDate: active.filter(t => !t.targetDeploymentDate).length, missingEstimate: active.filter(t => t.estimateHours == null).length,
    createdThisWeek: tasks.filter(t => recently(t.createdAt)).length,
    completedThisWeek: completed.filter(t => recently(t.completedAt)).length,
    averageCompletionDays: durations.length ? durations.reduce((sum, days) => sum + days, 0) / durations.length : null,
    completionDateCount: durations.length,
    recent: [...tasks].sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,5)
  };
}
