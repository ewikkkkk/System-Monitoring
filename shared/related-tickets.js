export function parseRelatedTickets(value) {
  return [...new Map(String(value || '').split(/[,\n]/).map(reference => reference.trim()).filter(Boolean).map(reference => [reference.toLowerCase(), reference])).values()];
}
export const validRelatedTickets = value => value === undefined || (Array.isArray(value) && value.length <= 20 && value.every(reference => typeof reference === 'string' && reference.trim().length > 0 && reference.length <= 80 && !/[\u0000-\u001f]/.test(reference)));
export const readRelatedTickets = value => Array.isArray(value) ? value : value ? JSON.parse(value) : [];

export function listTasksForStatus(tasks, status) {
  return tasks.filter(task => status ? task.status === status : !['Prod live', 'Closed'].includes(task.status));
}
