export function validBugOccurrence(body) {
  return body && typeof body.occurredAt === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.occurredAt) && Number.isFinite(Date.parse(body.occurredAt)) &&
    Date.parse(body.occurredAt) <= Date.now() + 60000 && typeof body.notes === 'string' && body.notes.trim().length > 0 && body.notes.length <= 4000 &&
    typeof body.reference === 'string' && body.reference.length <= 80 && typeof body.reopen === 'boolean' &&
    (body.deploymentId == null || (Number.isSafeInteger(body.deploymentId) && body.deploymentId > 0 && body.deploymentId <= 2147483647));
}
