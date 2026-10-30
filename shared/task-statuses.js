// Canonical module workflow. Legacy aliases remain readable without rewriting audit history.
export const taskWorkflow = [
  ['open','OPEN','Open'],
  ['ongoing-dev','ONGOING DEV','In progress'],
  ['testing-dl','FOR TESTING (DL)','In testing'],
  ['deployment-dl','FOR DEPLOYMENT (DL)','Ready for release'],
  ['dev-live','DEV LIVE','Ready for release'],
  ['ongoing-test','ONGOING TEST (DL)','In testing'],
  ['back-to-tech','BACK TO TECH (DL)','In progress'],
  ['ready','READY','Ready for release'],
  ['deployment-pl','FOR DEPLOYMENT (PL)','Ready for release'],
  ['malfunctioning','MALFUNCTIONING (PL)','In progress'],
  ['monitoring','FOR MONITORING','In progress'],
  ['prod-live','PROD LIVE (HYPERCARE)','Prod live'],
  ['complete','COMPLETE','Closed']
].map(([key,label,legacy])=>({key,label,legacy,summary:label}));
export const taskStatuses = taskWorkflow.map(status=>status.label);
const aliases = {'Open':'OPEN','In progress':'ONGOING DEV','In testing':'FOR TESTING (DL)','Ready for release':'FOR DEPLOYMENT (PL)','Prod live':'PROD LIVE (HYPERCARE)','Closed':'COMPLETE'};
export const normalizeTaskStatus = status => aliases[status] || status;
export const validTaskStatus = status => typeof status==='string' && taskStatuses.includes(normalizeTaskStatus(status));
export const compatibilityTaskStatus = status => taskWorkflow.find(item=>item.label===normalizeTaskStatus(status))?.legacy;
export const isCompletedStatus = status => ['PROD LIVE (HYPERCARE)','COMPLETE'].includes(normalizeTaskStatus(status));
export const isTestingStatus = status => ['FOR TESTING (DL)','ONGOING TEST (DL)'].includes(normalizeTaskStatus(status));
