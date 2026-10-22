export const taskSystems = ['WMS', 'Client Portal', 'RF Barcoding', 'PISA', 'CMMS', 'TOLL'];
export const validTaskSystem = (value, previous) => taskSystems.includes(value) || (previous !== undefined && value === previous);
export const validTaskModule = value => value === undefined || (typeof value === 'string' && value.length <= 120);
