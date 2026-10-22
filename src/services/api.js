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
export const getPeople = () => request('/people');
export const getDeployments = () => request('/deployments');
export const getVouchers = () => request('/vouchers');
export const addVoucher = body => request('/vouchers',{method:'POST',body:JSON.stringify(body)});
export const importVouchers = body => request('/vouchers/import',{method:'POST',body:JSON.stringify(body)});
export const restoreVoucher = (id, reason) => request(`/vouchers/${encodeURIComponent(id)}/restore`,{method:'POST',body:JSON.stringify({reason})});
export const useVoucher = (id,body) => request(`/vouchers/${encodeURIComponent(id)}/use`,{method:'POST',body:JSON.stringify(body)});
export const getVoucherHistory = id => request(`/vouchers/${encodeURIComponent(id)}/history`);
export const logDeployment = body => request('/deployments', { method: 'POST', body: JSON.stringify(body) });
export const changeTaskStatus = (id, status) => request(`/tasks/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const getTaskHistory = id => request(`/tasks/${encodeURIComponent(id)}/history`);
export const saveTask = (id, body) => request(id ? `/tasks/${encodeURIComponent(id)}` : '/tasks', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
