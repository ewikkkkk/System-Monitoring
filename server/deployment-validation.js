export function validDeployment(body) {
  return body && Number.isSafeInteger(body.taskId) && body.taskId > 0 &&
    ['Deployment', 'Fix', 'Revert'].includes(body.action) &&
    typeof body.version === 'string' && body.version.trim().length > 0 && body.version.length <= 120 &&
    typeof body.notes === 'string' && body.notes.trim().length > 0 && body.notes.length <= 8000 &&
    typeof body.occurredAt === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.occurredAt) && Number.isFinite(Date.parse(body.occurredAt)) &&
    (body.action === 'Revert' ? Number.isSafeInteger(body.revertsId) && body.revertsId > 0 : body.revertsId == null);
}
