export const voucherLocations = ['Bancal 1', 'Bancal 2'];
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);

export function validVoucher(body) {
  return body && text(body.code, 120, true) && voucherLocations.includes(body.location);
}
export function validVoucherUsage(body) {
  if (!body || !['Use','Invalid'].includes(body.outcome) || !voucherLocations.includes(body.requestedLocation) ||
      typeof body.occurredAt !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.occurredAt) || !Number.isFinite(Date.parse(body.occurredAt))) return false;
  const use = body.outcome === 'Use';
  return text(body.ticketReference,80,use) && text(body.personInvolved,160,use) && text(body.client,160,use) &&
    text(body.device,160,use) && text(body.purpose,2000,use) && text(body.finding,2000,!use) &&
    (body.durationHours == null ? !use : Number.isFinite(body.durationHours) && body.durationHours > 0 && body.durationHours <= 8760);
}
export function voucherOutcome(voucher, body) {
  const mismatch = voucher.location !== body.requestedLocation;
  return {
    status: mismatch ? 'Active' : body.outcome === 'Invalid' ? 'Invalid' : 'Used',
    finding: [mismatch ? `Location mismatch: voucher is for ${voucher.location}; requested at ${body.requestedLocation}.` : '', body.finding.trim()].filter(Boolean).join(' ')
  };
}

export function validVoucherImport(body) {
  return body && voucherLocations.includes(body.location) && Array.isArray(body.codes) && body.codes.length > 0 && body.codes.length <= 500 &&
    body.codes.every(code => typeof code === 'string' && /^\d{5}-\d{5}$/.test(code));
}
