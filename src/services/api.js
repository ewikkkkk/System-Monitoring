let getToken = async () => null;
export function configureMonitoringAuth(tokenGetter) { getToken = tokenGetter; }
const base = '/api/system-monitoring';
async function request(path, options = {}) {
  const token = await getToken();
  const response = await fetch(`${base}${path}`, { ...options, credentials: 'omit', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers
  } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const getTasks = () => request('/tasks');
export const getPeople = () => request('/people');
export const getTaskHistory = id => request(`/tasks/${encodeURIComponent(id)}/history`);
export const saveTask = (id, body) => request(id ? `/tasks/${encodeURIComponent(id)}` : '/tasks', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
