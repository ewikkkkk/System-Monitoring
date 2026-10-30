import { buildTicketReport } from '../../shared/ticket-report.js';

let getToken = async () => null;
let demoMode = false;
export const isMonitoringDemo = () => demoMode;
export function configureMonitoringAuth(tokenGetter) { getToken = tokenGetter; }
// Temporary same-module placeholder. Replace this resolver with the host Help Desk URL when connected.
export function getHelpDeskTicketUrl(reference) {
  const params = new URLSearchParams();
  params.set('helpdeskTicket', reference);
  return `${window.location.pathname}?${params.toString()}`;
}
export function getHelpDeskTicketPreview() {
  return typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('helpdeskTicket');
}
const base = '/api/system-monitoring';
async function request(path, options = {}) {
  const token = await getToken();
  const response = await fetch(`${base}${path}`, { ...options, credentials: 'omit', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers
  } });
  demoMode = response.headers.get('X-System-Monitoring-Mode') === 'demo';
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const getTasks = () => request('/tasks');
export const getMyTasks = () => request('/my-tasks');
export const getMonitoringPermissions = () => request('/permissions');
export const getTicketReports = () => request('/ticket-reports');
export const getTicketReport = async id => withReportTicketLinks(await request(`/ticket-reports/${encodeURIComponent(id)}`));
export const saveTicketReport = body => request('/ticket-reports',{method:'POST',body:JSON.stringify(body)});
export const getReportTeamsStatus = id => request(`/ticket-reports/${encodeURIComponent(id)}/teams`);
export const prepareReportTeams = (id,destinationId) => request(`/ticket-reports/${encodeURIComponent(id)}/teams/preview`,{method:'POST',body:JSON.stringify({destinationId})});
export const sendReportTeams = (id,body) => request(`/ticket-reports/${encodeURIComponent(id)}/teams/send`,{method:'POST',body:JSON.stringify(body)});
// Confirmed Help Desk destination supplied by the user. Keep URL paths in this seam.
export const getReportTicketLinkTemplate = () => 'https://www.mcssi.ph:3001/#/tickets/{ticket}';
export function getReportTicketUrl(reference,template=getReportTicketLinkTemplate()) {
  if(!template.trim())return '';
  if(!template.includes('{ticket}'))throw new Error('The Help Desk link template must include {ticket}.');
  const url=new URL(template.replaceAll('{ticket}',encodeURIComponent(reference)));
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Use an HTTP or HTTPS Help Desk link without credentials.');
  return url.href;
}
// Add newly configured links to old report presentation/copy without rewriting saved snapshots.
export function withReportTicketLinks(report) {
  if(!report.tickets.some(ticket=>!ticket.url))return report;
  return {...report,...buildTicketReport({...report,tickets:report.tickets.map(ticket=>({...ticket,url:ticket.url||getReportTicketUrl(ticket.ticketId)}))})};
}
export const getPeople = () => request('/people');
export const getDeployments = () => request('/deployments');
export const getBugOccurrences = () => request('/bug-occurrences');
export const getTaskTimeline = () => request('/task-timeline');
export const getTaskResolutions = () => request('/task-resolutions');
export const logBugOccurrence = (id,body) => request(`/tasks/${encodeURIComponent(id)}/occurrences`,{method:'POST',body:JSON.stringify(body)});
export const getVouchers = () => request('/vouchers');
export const addVoucher = body => request('/vouchers',{method:'POST',body:JSON.stringify(body)});
export const importVouchers = body => request('/vouchers/import',{method:'POST',body:JSON.stringify(body)});
export const restoreVoucher = (id, reason) => request(`/vouchers/${encodeURIComponent(id)}/restore`,{method:'POST',body:JSON.stringify({reason})});
export const useVoucher = (id,body) => request(`/vouchers/${encodeURIComponent(id)}/use`,{method:'POST',body:JSON.stringify(body)});
export const getVoucherHistory = id => request(`/vouchers/${encodeURIComponent(id)}/history`);
export const logDeployment = body => request('/deployments', { method: 'POST', body: JSON.stringify(body) });
export const changeTaskStatus = (id, status) => request(`/tasks/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const getTaskComments = id => request(`/tasks/${encodeURIComponent(id)}/comments`);
export const getTaskHistory = id => request(`/tasks/${encodeURIComponent(id)}/history`);
export const saveTask = (id, body) => request(id ? `/tasks/${encodeURIComponent(id)}` : '/tasks', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
