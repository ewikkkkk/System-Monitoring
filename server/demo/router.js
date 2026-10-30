// Throwaway local demo adapter; the METS Hub integration uses server/index.js.
import { Router, json } from 'express';
import { validCommentChanges } from '../../shared/task-comments.js';
import { validDeployment } from '../deployment-validation.js';
import { formatTaskNumber } from '../../shared/task-number.js';
import { validVoucher, validVoucherUsage, voucherOutcome, validVoucherImport } from '../voucher-validation.js';
import { validRelatedTickets } from '../../shared/related-tickets.js';
import { validBugOccurrence } from '../bug-validation.js';
import { validTaskSystem, validTaskModule, validTaskRemarks, validTargetDeploymentDate } from '../../shared/task-fields.js';
import { taskResolutions } from '../../shared/task-resolutions.js';
import { prepareTicketReport, ticketReportSummary } from '../ticket-report-validation.js';
import { createDemoTeamsRepository } from '../teams/repositories.js';
import { teamsStatus, prepareTeamsReport, sendTeamsReport } from '../teams/delivery.js';

import { normalizeTaskStatus, validTaskStatus, isCompletedStatus } from '../../shared/task-statuses.js';
const completed = isCompletedStatus;
export function createDemoMonitoringRouter(store) {
  const r = Router();
  r.use('/ticket-reports',json({limit:'3mb'}));
  r.use(json({ limit: '100kb' }));
  r.use((req, res, next) => { res.set('X-System-Monitoring-Mode', 'demo'); next(); });
  const teamsRepository=createDemoTeamsRepository(store);
  r.get('/ticket-reports/:id/teams',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const report=teamsReport(req,res);if(!report)return;
    res.json(await teamsStatus(report,req.app.locals.systemMonitoringTeams,teamsRepository));
  });
  r.post('/ticket-reports/:id/teams/preview',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const report=teamsReport(req,res);if(!report)return;
    const result=await prepareTeamsReport(report,req.app.locals.systemMonitoringTeams,req.body?.destinationId,String(req.user.userId));res.status(result.status).json(result);
  });
  r.post('/ticket-reports/:id/teams/send',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const report=teamsReport(req,res);if(!report)return;
    const result=await sendTeamsReport({report,service:req.app.locals.systemMonitoringTeams,repository:teamsRepository,destinationId:req.body?.destinationId,previewHash:req.body?.previewHash,actorId:String(req.user.userId)});res.status(result.status).json(result);
  });
  function teamsReport(req,res){
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1||id>2147483647){res.status(400).json({error:'Invalid report ID'});return;}
    const report=(store.snapshot().ticketReports||[]).find(report=>report.id===id);if(!report){res.status(404).json({error:'Report not found'});return;}return report;
  }
  r.get('/ticket-reports',(req,res)=>res.json((store.snapshot().ticketReports||[]).map(ticketReportSummary).sort((a,b)=>b.reportDate.localeCompare(a.reportDate)||b.asOfTime.localeCompare(a.asOfTime)||b.id-a.id)));
  r.get('/ticket-reports/:id',(req,res)=>{
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1||id>2147483647)return res.status(400).json({error:'Invalid report ID'});
    const report=(store.snapshot().ticketReports||[]).find(report=>report.id===id);
    if(!report)return res.status(404).json({error:'Report not found'});
    const {requestId,...view}=report;res.json(view);
  });
  r.post('/ticket-reports',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    let report;try{report=prepareTicketReport(req.body);}catch(error){return res.status(400).json({error:error.message});}
    const result=await store.update(state=>{
      state.ticketReports||=[];const old=state.ticketReports.find(row=>row.requestId===req.body.requestId);if(old)return old;
      const saved={...report,id:Math.max(0,...state.ticketReports.map(row=>row.id))+1,requestId:req.body.requestId,actorId:String(req.user.userId),createdAt:new Date().toISOString()};
      state.ticketReports.push(saved);return saved;
    });
    const {requestId,...view}=result;res.status(201).json(view);
  });
  r.get('/people', (req, res) => res.json(store.snapshot().people));
  function taskViews(tasks,people){
    return tasks.map(t=>({...t,remarks:t.remarks||'',status:normalizeTaskStatus(t.status),moduleName:t.moduleName||'',relatedTickets:t.relatedTickets||[],taskNumber:formatTaskNumber(t),developerName:people.find(p=>p.userId===t.developerId)?.displayName||null,testerName:people.find(p=>p.userId===t.testerId)?.displayName||null})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  r.get('/my-tasks',(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const {tasks,people}=store.snapshot(),actor=String(req.user.userId);
    res.json(taskViews(tasks.filter(task=>task.developerId===actor||task.testerId===actor),people));
  });
  r.get('/tasks', (req, res) => {
    const { tasks, people } = store.snapshot();
    res.json(tasks.map(t => ({ ...t, remarks:t.remarks||'', status:normalizeTaskStatus(t.status), moduleName:t.moduleName||'', relatedTickets:t.relatedTickets||[],
      taskNumber: formatTaskNumber(t),
      developerName: people.find(p => p.userId === t.developerId)?.displayName || null,
      testerName: people.find(p => p.userId === t.testerId)?.displayName || null
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  });
  r.get('/tasks/:id/comments',(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const id=Number(req.params.id),state=store.snapshot();
    if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid task ID'});
    if(!state.tasks.some(task=>task.id===id))return res.status(404).json({error:'Task not found'});
    res.json((state.comments||[]).filter(comment=>comment.taskId===id).map(({requestId,...comment})=>({...comment,
      authorName:state.people.find(person=>person.userId===comment.actorId)?.displayName||comment.actorId,
      canEdit:comment.actorId===String(req.user.userId)})).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id-b.id));
  });
  r.get('/tasks/:id/history', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid task ID' });
    res.json(store.snapshot().history.filter(h => h.taskId === id).sort((a, b) => b.id - a.id));
  });
  r.post('/tasks', save);
  r.get('/task-timeline',(req,res)=>{
    const starts=new Map();
    for(const entry of store.snapshot().history){if(normalizeTaskStatus(entry.status)!=='ONGOING DEV'||!Number.isFinite(Date.parse(entry.changedAt)))continue;const previous=starts.get(entry.taskId);if(!previous||Date.parse(entry.changedAt)<Date.parse(previous))starts.set(entry.taskId,entry.changedAt);}
    res.json([...starts].map(([taskId,firstDevAt])=>({taskId,firstDevAt})));
  });
  r.get('/task-resolutions',(req,res)=>res.json(taskResolutions(store.snapshot().history).reverse()));
  r.get('/bug-occurrences',(req,res)=>res.json((store.snapshot().bugOccurrences||[]).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id-a.id)));
  r.post('/tasks/:id/occurrences',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const id=Number(req.params.id),b=req.body;
    if(!Number.isSafeInteger(id)||id<1||id>2147483647||!validBugOccurrence(b))return res.status(400).json({error:'Enter a valid recurrence date, ticket and notes; future reports are not allowed'});
    const result=await store.update(state=>{
      const task=state.tasks.find(task=>task.id===id);
      if(!task)return {error:'Task not found',status:404};
      if(task.type!=='Bug'||Date.parse(b.occurredAt)<Date.parse(task.createdAt))return {error:'Recurrence must be for a bug and occur on or after task creation',status:400};
      if(b.deploymentId!=null&&!(state.deployments||[]).some(event=>event.id===b.deploymentId&&Date.parse(event.occurredAt)<=Date.parse(b.occurredAt)))return {error:'Choose a production event at or before the recurrence',status:400};
      state.bugOccurrences||=[];
      const occurrenceId=Math.max(0,...state.bugOccurrences.map(event=>event.id))+1,now=new Date().toISOString(),actor=String(req.user.userId);
      state.bugOccurrences.push({id:occurrenceId,taskId:id,occurredAt:new Date(b.occurredAt).toISOString(),reference:b.reference.trim(),notes:b.notes.trim(),deploymentId:b.deploymentId??null,recordedAt:now,actorId:actor});
      Object.assign(task,{updatedAt:now,updatedBy:actor});
      if(b.reopen&&completed(task.status))Object.assign(task,{status:'OPEN',completedAt:null,updatedAt:now,updatedBy:actor});
      state.history.push({id:Math.max(0,...state.history.map(h=>h.id))+1,taskId:id,actorId:actor,status:task.status,notes:`Recurrence reported. ${b.notes.trim()}`,changedAt:now});
      return {id:occurrenceId};
    });
    if(result.error)return res.status(result.status).json({error:result.error});
    res.status(201).json(result);
  });
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
    const id = Number(req.params.id), status = normalizeTaskStatus(req.body?.status);
    if (!Number.isSafeInteger(id) || id < 1 || !validTaskStatus(status)) return res.status(400).json({ error: 'Invalid task or status' });
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
    if(!validCommentChanges(b))return res.status(400).json({error:'Comments must contain 1–4000 characters; refresh before retrying invalid comment edits.'});
    const strings = { title: 240, reference: 80, system: 100, description: 8000, notes: 8000 };
    const validDate = !b.dueDate || (typeof b.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) && !Number.isNaN(Date.parse(b.dueDate)) && new Date(b.dueDate).toISOString().slice(0, 10) === b.dueDate);
    if ((id !== null && (!Number.isSafeInteger(id) || id < 1)) ||
      Object.entries(strings).some(([k, max]) => typeof b[k] !== 'string' || b[k].length > max) || !b.title?.trim() ||
      !['Bug', 'Enhancement'].includes(b.type) || !validTaskStatus(b.status) || !['Low', 'Normal', 'High', 'Urgent'].includes(b.priority) ||
      !validRelatedTickets(b.relatedTickets) || !validTaskModule(b.moduleName) || !validTaskRemarks(b.remarks) || !validTargetDeploymentDate(b.targetDeploymentDate) || !validDate || (b.estimateHours != null && (!Number.isFinite(b.estimateHours) || b.estimateHours < 0 || b.estimateHours > 9999))) {
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
      if(!validTaskSystem(b.system,old?.system))return {error:'Choose WMS, Client Portal, RF Barcoding, PISA, CMMS or TOLL'};
      const actor=String(req.user.userId),comments=state.comments||[];
      if((b.commentEdits||[]).some(edit=>!comments.some(comment=>comment.id===edit.id&&comment.taskId===id&&comment.actorId===actor)))return {error:'Only your own comments can be edited',statusCode:403};
      if(b.newComment&&comments.some(comment=>comment.requestId===b.newComment.requestId&&(comment.taskId!==id||comment.actorId!==actor)))return {error:'Comment request belongs to another task or author',statusCode:403};
      const now = new Date().toISOString();
      const taskId = old?.id ?? Math.max(0, ...state.tasks.map(t => t.id)) + 1;
      const task = {
        id: taskId, ...Object.fromEntries(Object.keys(strings).map(k => [k, b[k]])), title: b.title.trim(),
        type: b.type, status: normalizeTaskStatus(b.status), priority: b.priority, developerId: b.developerId || null, testerId: b.testerId || null,
        dueDate: b.dueDate || null, estimateHours: b.estimateHours ?? null, targetDeploymentDate:b.targetDeploymentDate===undefined?(old?.targetDeploymentDate||null):b.targetDeploymentDate||null, remarks:b.remarks===undefined?(old?.remarks||''):b.remarks.trim(), moduleName:b.moduleName===undefined?(old?.moduleName||''):b.moduleName.trim(), relatedTickets:b.relatedTickets===undefined?(old?.relatedTickets||[]):[...new Set(b.relatedTickets.map(reference=>reference.trim()))],
        createdBy: old?.createdBy || String(req.user.userId), updatedBy: String(req.user.userId),
        createdAt: old?.createdAt || now, updatedAt: now, completedAt: completed(b.status) ? old?.completedAt || now : null
      };
      for(const edit of b.commentEdits||[]){const comment=comments.find(comment=>comment.id===edit.id);comment.text=edit.text.trim();comment.editedAt=now;}
      if(b.newComment&&!comments.some(comment=>comment.requestId===b.newComment.requestId))comments.push({id:Math.max(0,...comments.map(comment=>comment.id))+1,taskId,actorId:actor,text:b.newComment.text.trim(),requestId:b.newComment.requestId,createdAt:now,editedAt:null});
      state.comments=comments;
      if (old) state.tasks[state.tasks.findIndex(t => t.id === taskId)] = task;
      else state.tasks.push(task);
      state.history.push({ id: Math.max(0, ...state.history.map(h => h.id)) + 1, taskId, actorId: String(req.user.userId), status: normalizeTaskStatus(b.status), notes: b.newComment?`Comment added. ${b.newComment.text.trim()}`:b.commentEdits?.length?'Conversation comment edited.':b.notes, changedAt: now });
      return { id: taskId };
    });
    if (!result) return res.status(404).json({ error: 'Task not found' });
    if(result.error)return res.status(result.statusCode||400).json({error:result.error});
    res.status(id ? 200 : 201).json(result);
  }
  r.use((error, req, res, next) => {
    if(error.type==='entity.too.large')return res.status(413).json({error:'Request is too large. Import fewer ticket rows.'});
    console.error('Demo request failed:', error.code || error.name);
    res.status(error.type === 'entity.parse.failed' ? 400 : 500).json({ error: error.type === 'entity.parse.failed' ? 'Invalid JSON body' : 'Could not save the local demo database' });
  });
  return r;
}
