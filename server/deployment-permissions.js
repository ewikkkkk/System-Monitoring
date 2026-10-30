// Trusted host capability, populated after the host's router-level admin policy.
// Never derive permissions from a request body, query string or custom header.
export function monitoringPermissions(req){
 return {canManageDeploymentDates:!!req.user?.userId&&req.monitoringPermissions?.canManageDeploymentDates===true};
}
export function deploymentDateWriteError(req){
 return req.body?.targetDeploymentDate!==undefined&&!monitoringPermissions(req).canManageDeploymentDates
  ?'Only an administrator can set or change the target deployment date.':null;
}
