// Throwaway local demo adapter; the METS Hub integration uses server/index.js.
import { Router, json } from 'express';
import { validDeployment } from '../deployment-validation.js';
import { formatTaskNumber } from '../../shared/task-number.js';

const statuses = ['Open', 'In progress', 'In testing', 'Ready for release', 'Prod live', 'Closed'];
const completed = status => ['Prod live', 'Closed'].includes(status);
export function createDemoMonitoringRouter(store) {
  const r = Router();
  r.use(json({ limit: '100kb' }));
  r.use((req, res, next) => { res.set('X-System-Monitoring-Mode', 'demo'); next(); });
  r.get('/people', (req, res) => res.json(store.snapshot().people));
  r.get('/tasks', (req, res) => {
    const { tasks, people } = store.snapshot();
    res.json(tasks.map(t => ({ ...t,
      taskNumber: formatTaskNumber(t),
      developerName: people.find(p => p.userId === t.developerId)?.displayName || null,
      testerName: people.find(p => p.userId === t.testerId)?.displayName || null
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  });
  r.get('/tasks/:id/history', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid task ID' });
    res.json(store.snapshot().history.filter(h => h.taskId === id).sort((a, b) => b.id - a.id));
  });
  r.post('/tasks', save);
  r.put('/tasks/:id', save);
  r.patch('/tasks/:id/status', async (req, res) => {
    if (!req.user?.userId) return res.status(401).json({ error: 'Host user context is required' });
    const id = Number(req.params.id), status = req.body?.status;
    if (!Number.isSafeInteger(id) || id < 1 || !statuses.includes(status)) return res.status(400).json({ error: 'Invalid task or status' });
    const result = await store.update(state => {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return null;
      const now = new Date().toISOString();
      Object.assign(task, { status, updatedBy: String(req.user.userId), updatedAt: now, completedAt: completed(status) ? task.completedAt || now : null });
      state.history.push({ id: Math.max(0,...state.history.map(h => h.id))+1, taskId:id, actorId:String(req.user.userId), status, notes:`Status changed to ${status}`, changedAt:now });
      return { id, status, updatedAt:task.updatedAt, completedAt:task.completedAt };
    });
    if (!result) return res.status(404).json({ error:'Task not found' });
    res.json(result);
  });
  r.get('/deployments', (req, res) => {
    const state = store.snapshot();
    res.json((state.deployments || []).map(d => {
      const task = state.tasks.find(t => t.id === d.taskId);
      return { ...d, title:task?.title, reference:task?.reference, type:task?.type, system:task?.system,
        taskNumber: formatTaskNumber({taskId:d.taskId,type:task?.type}) };
    }).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt) || b.id-a.id));
  });
  r.post('/deployments', async (req, res) => {
    if (!req.user?.userId) return res.status(401).json({ error: 'Host user context is required' });
    const b=req.body;
    if (!validDeployment(b)) return res.status(400).json({ error:'Provide a task, event, date, version, and notes. Reverts require an original event.' });
    const result = await store.update(state => {
      state.deployments ||= [];
      if (!state.tasks.some(t => t.id===b.taskId)) return { error:'Task not found', status:404 };
      if (b.action==='Revert') {
        const original=state.deployments.find(d => d.id===b.revertsId && d.taskId===b.taskId && d.action!=='Revert');
        if (!original || new Date(b.occurredAt)<new Date(original.occurredAt) || state.deployments.some(d=>d.revertsId===b.revertsId)) return {error:'Invalid revert target/date, or already reverted',status:409};
      }
      const id=Math.max(0,...state.deployments.map(d=>d.id))+1;
      state.deployments.push({ id,taskId:b.taskId,action:b.action,version:b.version.trim(),notes:b.notes.trim(),occurredAt:new Date(b.occurredAt).toISOString(),recordedAt:new Date().toISOString(),actorId:String(req.user.userId),revertsId:b.revertsId??null });
      return {id};
    });
    if(result.error) return res.status(result.status).json({error:result.error});
    res.status(201).json(result);
  });
  async function save(req, res) {
    if (!req.user?.userId) return res.status(401).json({ error: 'Host user context is required' });
    const id = req.params.id ? Number(req.params.id) : null;
    const b = req.body || {};
    const strings = { title: 240, reference: 80, system: 100, description: 8000, notes: 8000 };
    const validDate = !b.dueDate || (typeof b.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) && !Number.isNaN(Date.parse(b.dueDate)) && new Date(b.dueDate).toISOString().slice(0, 10) === b.dueDate);
    if ((id !== null && (!Number.isSafeInteger(id) || id < 1)) ||
      Object.entries(strings).some(([k, max]) => typeof b[k] !== 'string' || b[k].length > max) || !b.title?.trim() ||
      !['Bug', 'Enhancement'].includes(b.type) || !statuses.includes(b.status) || !['Low', 'Normal', 'High', 'Urgent'].includes(b.priority) ||
      !validDate || (b.estimateHours != null && (!Number.isFinite(b.estimateHours) || b.estimateHours < 0 || b.estimateHours > 9999))) {
      return res.status(400).json({ error: 'Check required fields, dates, and field lengths' });
    }
    const people = store.snapshot().people;
    for (const role of ['developer', 'tester']) {
      const assignment = b[`${role}Id`];
      if (assignment && !people.some(p => p.userId === assignment && [role, 'both'].includes(p.assignmentRole))) {
        return res.status(400).json({ error: `Choose a registered ${role}` });
      }
    }
    const result = await store.update(state => {
      const old = id === null ? null : state.tasks.find(t => t.id === id);
      if (id !== null && !old) return null;
      const now = new Date().toISOString();
      const taskId = old?.id ?? Math.max(0, ...state.tasks.map(t => t.id)) + 1;
      const task = {
        id: taskId, ...Object.fromEntries(Object.keys(strings).map(k => [k, b[k]])), title: b.title.trim(),
        type: b.type, status: b.status, priority: b.priority, developerId: b.developerId || null, testerId: b.testerId || null,
        dueDate: b.dueDate || null, estimateHours: b.estimateHours ?? null,
        createdBy: old?.createdBy || String(req.user.userId), updatedBy: String(req.user.userId),
        createdAt: old?.createdAt || now, updatedAt: now, completedAt: completed(b.status) ? old?.completedAt || now : null
      };
      if (old) state.tasks[state.tasks.findIndex(t => t.id === taskId)] = task;
      else state.tasks.push(task);
      state.history.push({ id: Math.max(0, ...state.history.map(h => h.id)) + 1, taskId, actorId: String(req.user.userId), status: b.status, notes: b.notes, changedAt: now });
      return { id: taskId };
    });
    if (!result) return res.status(404).json({ error: 'Task not found' });
    res.status(id ? 200 : 201).json(result);
  }
  r.use((error, req, res, next) => {
    console.error('Demo request failed:', error.code || error.name);
    res.status(error.type === 'entity.parse.failed' ? 400 : 500).json({ error: error.type === 'entity.parse.failed' ? 'Invalid JSON body' : 'Could not save the local demo database' });
  });
  return r;
}
