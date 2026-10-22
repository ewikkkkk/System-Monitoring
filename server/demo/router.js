// Throwaway local demo adapter; the METS Hub integration uses server/index.js.
import { Router, json } from 'express';
import { validDeployment } from '../deployment-validation.js';
import { formatTaskNumber } from '../../shared/task-number.js';
import { validVoucher, validVoucherUsage, voucherOutcome, validVoucherImport } from '../voucher-validation.js';

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
  r.get('/vouchers',(req,res)=>res.json((store.snapshot().vouchers||[]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id-a.id)));
  r.get('/vouchers/:id/history',(req,res)=>{
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid voucher ID'});
    res.json((store.snapshot().voucherHistory||[]).filter(h=>h.voucherId===id).sort((a,b)=>b.id-a.id));
  });
  r.post('/vouchers',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const b=req.body;
    if(!validVoucher(b))return res.status(400).json({error:'Enter a voucher code and Bancal location'});
    const result=await store.update(state=>{
      state.vouchers||=[];state.voucherHistory||=[];
      if(state.vouchers.some(v=>v.code.toLowerCase()===b.code.trim().toLowerCase()))return null;
      const id=Math.max(0,...state.vouchers.map(v=>v.id))+1,now=new Date().toISOString(),actor=String(req.user.userId);
      state.vouchers.push({id,code:b.code.trim(),location:b.location,status:'Active',ticketReference:'',personInvolved:'',client:'',device:'',purpose:'',durationHours:null,requestedLocation:null,finding:'',occurredAt:null,createdAt:now,updatedAt:now,createdBy:actor,updatedBy:actor});
      state.voucherHistory.push({id:Math.max(0,...state.voucherHistory.map(h=>h.id))+1,voucherId:id,action:'Added',status:'Active',note:'Voucher added to active inventory',actorId:actor,changedAt:now});
      return {id};
    });
    if(!result)return res.status(409).json({error:'This voucher code already exists'});
    res.status(201).json(result);
  });
  r.post('/vouchers/import',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    if(!validVoucherImport(req.body))return res.status(400).json({error:'Choose a Bancal location and 1–500 valid voucher codes'});
    const result=await store.update(state=>{
      state.vouchers||=[];state.voucherHistory||=[];
      const known=new Set(state.vouchers.map(v=>v.code.toLowerCase()));
      let imported=0;
      for(const code of req.body.codes){
        if(known.has(code.toLowerCase()))continue;
        const id=Math.max(0,...state.vouchers.map(v=>v.id))+1,now=new Date().toISOString(),actor=String(req.user.userId);
        state.vouchers.push({id,code,location:req.body.location,status:'Active',ticketReference:'',personInvolved:'',client:'',device:'',purpose:'',durationHours:null,requestedLocation:null,finding:'',occurredAt:null,createdAt:now,updatedAt:now,createdBy:actor,updatedBy:actor});
        state.voucherHistory.push({id:Math.max(0,...state.voucherHistory.map(h=>h.id))+1,voucherId:id,action:'Imported',status:'Active',note:'Imported to active inventory',actorId:actor,changedAt:now});
        known.add(code.toLowerCase()); imported++;
      }
      return {imported,skipped:req.body.codes.length-imported};
    });
    res.status(201).json(result);
  });
  r.post('/vouchers/:id/restore',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const id=Number(req.params.id),reason=req.body?.reason;
    if(!Number.isSafeInteger(id)||id<1||typeof reason!=='string'||!reason.trim()||reason.length>2000)return res.status(400).json({error:'Enter a reason for returning the voucher to active inventory'});
    const result=await store.update(state=>{
      const voucher=(state.vouchers||[]).find(v=>v.id===id);
      if(!voucher)return {error:'Voucher not found',statusCode:404};
      if(voucher.status!=='Invalid'||!voucher.requestedLocation||voucher.requestedLocation===voucher.location||!voucher.finding.startsWith('Location mismatch:'))return {error:'Only a location-mismatch voucher can be returned to active inventory',statusCode:409};
      const now=new Date().toISOString(),actor=String(req.user.userId),details=JSON.stringify(voucher);
      Object.assign(voucher,{status:'Active',updatedAt:now,updatedBy:actor});
      state.voucherHistory||=[];
      state.voucherHistory.push({id:Math.max(0,...state.voucherHistory.map(h=>h.id))+1,voucherId:id,action:'Returned to active',status:'Active',note:reason.trim(),details,actorId:actor,changedAt:now});
      return voucher;
    });
    if(result.error)return res.status(result.statusCode).json({error:result.error});
    res.json(result);
  });
  r.post('/vouchers/:id/use',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const id=Number(req.params.id),b=req.body;
    if(!Number.isSafeInteger(id)||id<1||!validVoucherUsage(b))return res.status(400).json({error:'Check required ticket, recipient, details, duration, location and finding'});
    const result=await store.update(state=>{
      const voucher=(state.vouchers||[]).find(v=>v.id===id);
      if(!voucher)return {error:'Voucher not found',statusCode:404};
      if(voucher.status!=='Active')return {error:'Voucher is no longer active. Refresh the inventory.',statusCode:409};
      const next=voucherOutcome(voucher,b),now=new Date().toISOString(),actor=String(req.user.userId);
      Object.assign(voucher,next,...['ticketReference','personInvolved','client','device','purpose'].map(key=>({[key]:b[key].trim()})),{durationHours:b.durationHours??null,requestedLocation:b.requestedLocation,occurredAt:new Date(b.occurredAt).toISOString(),updatedAt:now,updatedBy:actor});
      state.voucherHistory||=[];
      state.voucherHistory.push({id:Math.max(0,...state.voucherHistory.map(h=>h.id))+1,voucherId:id,action:next.status==='Active'?'Location mismatch':b.outcome==='Invalid'?'Finding recorded':'Use attempted',status:next.status,note:next.finding,details:JSON.stringify(b),actorId:actor,changedAt:now});
      return voucher;
    });
    if(result.error)return res.status(result.statusCode).json({error:result.error});
    res.json(result);
  });
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
