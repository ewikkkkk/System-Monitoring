// The database identity is stable. The display prefix follows the concern type.
// The external IT Help Desk reference never participates in task numbering.
export function formatTaskNumber({ id, taskId, type }) {
  const prefix = type === 'Enhancement' ? 'ENH' : 'BUG';
  const number = taskId ?? id;
  return Number.isSafeInteger(Number(number)) && Number(number) > 0
    ? `${prefix}-${String(number).padStart(4, '0')}`
    : `${prefix} (assigned on save)`;
}
