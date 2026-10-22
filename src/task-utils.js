export const statuses = ['Open', 'In progress', 'In testing', 'Ready for release', 'Prod live', 'Closed'];
export const blankTask = { title: '', reference: '', system: '', type: 'Bug', status: 'Open', priority: 'Normal', developerId: '', testerId: '', dueDate: '', estimateHours: '', description: '', notes: '' };
export const formatDate = value => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : '—';
export { formatTaskNumber as taskReference } from '../shared/task-number.js';
export const isComplete = task => ['Prod live', 'Closed'].includes(task.status);
export const unfinishedStatuses = statuses.filter(status => !isComplete({ status }));
