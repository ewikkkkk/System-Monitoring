import { taskStatuses, isCompletedStatus } from '../shared/task-statuses.js';
export const statuses = taskStatuses;
export const blankTask = { title: '', reference: '', relatedTickets: [], system: 'WMS', moduleName: '', remarks:'', type: 'Bug', status: 'OPEN', priority: 'Normal', developerId: '', testerId: '', targetDeploymentDate:'', estimateHours: '', description: '', notes: '' };
export const formatDate = value => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : '—';
export { formatTaskNumber as taskReference } from '../shared/task-number.js';
export const isComplete = task => isCompletedStatus(task.status);
export const unfinishedStatuses = statuses.filter(status => !isComplete({ status }));
