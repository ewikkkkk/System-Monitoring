export const taskSystems = ['WMS', 'Client Portal', 'RF Barcoding', 'PISA', 'CMMS', 'TOLL'];
export const validTaskSystem = (value, previous) => taskSystems.includes(value) || (previous !== undefined && value === previous);
export const validTaskModule = value => value === undefined || (typeof value === 'string' && value.length <= 120);

export const validTaskRemarks = value => value === undefined || (typeof value === 'string' && value.length <= 1000);

export function validTargetDeploymentDate(value){
 if(value===undefined||value===null||value==='')return true;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value)))return false;
 return Number(value.slice(0,4))>=1753&&Number(value.slice(0,4))<=9999&&new Date(value).toISOString().slice(0,10)===value;
}
