import { Router, json } from 'express';
import { query, sql, withPool } from './db/pool.js';
import { validDeployment } from './deployment-validation.js';
import { formatTaskNumber } from '../shared/task-number.js';
import { validVoucher, validVoucherUsage, validVoucherImport } from './voucher-validation.js';
import { readRelatedTickets, validRelatedTickets } from '../shared/related-tickets.js';
import { validBugOccurrence } from './bug-validation.js';
import { taskSystems, validTaskModule } from '../shared/task-fields.js';

const statuses = ['Open', 'In progress', 'In testing', 'Ready for release', 'Prod live', 'Closed'];
const priorities = ['Low', 'Normal', 'High', 'Urgent'];
export function createSystemMonitoringRouter(getPool) {
  const r = Router();
  r.use((req, res, next) => withPool(getPool, next));
  r.use(json({ limit: '100kb' }));
  // Host must restrict the entire router to authorized monitoring team members.
  // Writes additionally require developer, tester, or team-lead permission at host level.
  r.get('/people', async (req, res) => {
    const result = await query('SELECT userId, displayName, assignmentRole FROM monitoring.People WHERE active = 1 ORDER BY displayName');
    res.json(result.recordset);
  });
  r.get('/tasks', async (req, res) => {
    const result = await query(`SELECT t.*, d.displayName AS developerName, p.displayName AS testerName
      FROM monitoring.Tasks t LEFT JOIN monitoring.People d ON t.developerId = d.userId
      LEFT JOIN monitoring.People p ON t.testerId = p.userId ORDER BY t.updatedAt DESC`);
    res.json(result.recordset.map(task => ({ ...task, relatedTickets: readRelatedTickets(task.relatedTickets), taskNumber: formatTaskNumber(task) })));
  });
  r.get('/tasks/:id/history', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid task ID' });
    const result = await query('SELECT * FROM monitoring.TaskHistory WHERE taskId = @id ORDER BY changedAt DESC, id DESC', { id: { type: sql.Int, value: id } });
    res.json(result.recordset);
  });
  r.put('/tasks/:id', save);
  r.post('/tasks', save);
  // Host restricts resolution history to authorized monitoring viewers at router level.
  r.get('/task-resolutions',async(req,res)=>{
    const result=await query(`WITH ordered AS (
      SELECT id,taskId,changedAt,actorId,status,LAG(status) OVER(PARTITION BY taskId ORDER BY changedAt,id) AS previousStatus
      FROM monitoring.TaskHistory)
      SELECT id,taskId,changedAt AS occurredAt,actorId,status FROM ordered
      WHERE status IN ('Prod live','Closed') AND (previousStatus IS NULL OR previousStatus NOT IN ('Prod live','Closed'))
      ORDER BY changedAt DESC,id DESC`);
    res.json(result.recordset);
  });
  // Host: recurrence reads require monitoring-viewer access; writes require developers/testers/team leads.
  r.get('/bug-occurrences',async(req,res)=>{
    res.json((await query('SELECT * FROM monitoring.BugOccurrences ORDER BY occurredAt DESC,id DESC')).recordset);
  });
  r.post('/tasks/:id/occurrences',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const id=Number(req.params.id),b=req.body;
    if(!Number.isSafeInteger(id)||id<1||id>2147483647||!validBugOccurrence(b))return res.status(400).json({error:'Enter a valid recurrence date, ticket and notes; future reports are not allowed'});
    const result=await query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      DECLARE @type nvarchar(20),@createdAt datetime2,@status nvarchar(30);
      SELECT @type=type,@createdAt=createdAt,@status=status FROM monitoring.Tasks WITH(UPDLOCK,HOLDLOCK) WHERE id=@id;
      IF @type IS NULL THROW 50001,'Task not found',1;
      IF @type<>'Bug' OR @occurredAt<@createdAt THROW 50006,'Recurrence must be for a bug and occur on or after task creation',1;
      IF @deployment IS NOT NULL AND NOT EXISTS(SELECT 1 FROM monitoring.Deployments WHERE id=@deployment AND occurredAt<=@occurredAt)
        THROW 50006,'Choose a production event at or before the recurrence',1;
      DECLARE @created TABLE(id int);
      INSERT monitoring.BugOccurrences(taskId,occurredAt,reference,notes,deploymentId,actorId)
        OUTPUT INSERTED.id INTO @created VALUES(@id,@occurredAt,@reference,@notes,@deployment,@actor);
      UPDATE monitoring.Tasks SET updatedAt=SYSUTCDATETIME(),updatedBy=@actor WHERE id=@id;
      IF @reopen=1 AND @status IN ('Prod live','Closed') BEGIN
        UPDATE monitoring.Tasks SET status='Open',completedAt=NULL,updatedAt=SYSUTCDATETIME(),updatedBy=@actor WHERE id=@id;
        SET @status='Open';
      END;
      INSERT monitoring.TaskHistory(taskId,actorId,status,notes) VALUES(@id,@actor,@status,CONCAT('Recurrence reported. ',@notes));
      COMMIT; SELECT id FROM @created;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`,{
      id:{type:sql.Int,value:id},occurredAt:{type:sql.DateTime2,value:new Date(b.occurredAt)},reference:{type:sql.NVarChar(80),value:b.reference.trim()},
      notes:{type:sql.NVarChar(4000),value:b.notes.trim()},deployment:{type:sql.Int,value:b.deploymentId??null},reopen:{type:sql.Bit,value:b.reopen},actor:{type:sql.NVarChar(128),value:String(req.user.userId)}
    });
    res.status(201).json(result.recordset[0]);
  });
  // Host must restrict all voucher reads/writes to authorized Infra staff/team leads.
  // Codes can grant network access. Do not expose these routes to general task viewers.
  r.get('/vouchers', async (req,res) => {
    res.json((await query('SELECT * FROM monitoring.Vouchers ORDER BY updatedAt DESC,id DESC')).recordset);
  });
  r.get('/vouchers/:id/history', async (req,res) => {
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<1) return res.status(400).json({error:'Invalid voucher ID'});
    res.json((await query('SELECT * FROM monitoring.VoucherHistory WHERE voucherId=@id ORDER BY changedAt DESC,id DESC',{id:{type:sql.Int,value:id}})).recordset);
  });
  r.post('/vouchers', async (req,res) => {
    if(!req.user?.userId) return res.status(401).json({error:'Host user context is required'});
    if(!validVoucher(req.body)) return res.status(400).json({error:'Enter a voucher code and Bancal location'});
    const result=await query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      DECLARE @created TABLE(id int);
      INSERT monitoring.Vouchers(code,location,createdBy,updatedBy) OUTPUT INSERTED.id INTO @created VALUES(@code,@location,@actor,@actor);
      DECLARE @id int=(SELECT id FROM @created);
      INSERT monitoring.VoucherHistory(voucherId,action,status,note,actorId) VALUES(@id,'Added','Active','Voucher added to active inventory',@actor);
      COMMIT; SELECT id FROM @created;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`,{
      code:{type:sql.NVarChar(120),value:req.body.code.trim()},location:{type:sql.NVarChar(20),value:req.body.location},actor:{type:sql.NVarChar(128),value:String(req.user.userId)}
    });
    res.status(201).json(result.recordset[0]);
  });
  r.post('/vouchers/import', async (req,res) => {
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    if(!validVoucherImport(req.body))return res.status(400).json({error:'Choose a Bancal location and 1–500 valid voucher codes'});
    const result=await query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      DECLARE @created TABLE(id int);
      INSERT monitoring.Vouchers(code,location,createdBy,updatedBy) OUTPUT INSERTED.id INTO @created
        SELECT DISTINCT j.code,@location,@actor,@actor FROM OPENJSON(@codes) WITH(code nvarchar(120) '$') j
        WHERE NOT EXISTS(SELECT 1 FROM monitoring.Vouchers v WITH(UPDLOCK,HOLDLOCK) WHERE v.code=j.code);
      INSERT monitoring.VoucherHistory(voucherId,action,status,note,actorId)
        SELECT id,'Imported','Active','Imported to active inventory',@actor FROM @created;
      COMMIT; SELECT COUNT(*) AS imported,@total-COUNT(*) AS skipped FROM @created;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`,{
      codes:{type:sql.NVarChar(sql.MAX),value:JSON.stringify(req.body.codes)},location:{type:sql.NVarChar(20),value:req.body.location},
      actor:{type:sql.NVarChar(128),value:String(req.user.userId)},total:{type:sql.Int,value:req.body.codes.length}
    });
    res.status(201).json(result.recordset[0]);
  });
  r.post('/vouchers/:id/restore',async(req,res)=>{
    if(!req.user?.userId)return res.status(401).json({error:'Host user context is required'});
    const id=Number(req.params.id),reason=req.body?.reason;
    if(!Number.isSafeInteger(id)||id<1||typeof reason!=='string'||!reason.trim()||reason.length>2000)return res.status(400).json({error:'Enter a reason for returning the voucher to active inventory'});
    const result=await query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      DECLARE @previous nvarchar(10),@location nvarchar(20),@requested nvarchar(20),@finding nvarchar(2400);
      SELECT @previous=status,@location=location,@requested=requestedLocation,@finding=finding FROM monitoring.Vouchers WITH(UPDLOCK,HOLDLOCK) WHERE id=@id;
      IF @previous IS NULL THROW 50003,'Voucher not found',1;
      IF @previous<>'Invalid' OR @requested IS NULL OR @location=@requested OR @finding NOT LIKE 'Location mismatch:%'
        THROW 50005,'Only a location-mismatch voucher can be returned to active inventory',1;
      DECLARE @details nvarchar(max)=(SELECT ticketReference,personInvolved,client,device,purpose,durationHours,requestedLocation,finding,occurredAt FROM monitoring.Vouchers WHERE id=@id FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
      UPDATE monitoring.Vouchers SET status='Active',updatedAt=SYSUTCDATETIME(),updatedBy=@actor WHERE id=@id;
      INSERT monitoring.VoucherHistory(voucherId,action,status,note,details,actorId) VALUES(@id,'Returned to active','Active',@reason,@details,@actor);
      COMMIT; SELECT * FROM monitoring.Vouchers WHERE id=@id;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`,{
      id:{type:sql.Int,value:id},reason:{type:sql.NVarChar(2000),value:reason.trim()},actor:{type:sql.NVarChar(128),value:String(req.user.userId)}
    });
    res.json(result.recordset[0]);
  });
  r.post('/vouchers/:id/use', async (req,res) => {
    if(!req.user?.userId) return res.status(401).json({error:'Host user context is required'});
    const id=Number(req.params.id),b=req.body;
    if(!Number.isSafeInteger(id)||id<1||!validVoucherUsage(b)) return res.status(400).json({error:'Check the ticket, recipient, client, details, location, duration and finding'});
    const result=await query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      DECLARE @location nvarchar(20),@previous nvarchar(10);
      SELECT @location=location,@previous=status FROM monitoring.Vouchers WITH(UPDLOCK,HOLDLOCK) WHERE id=@id;
      IF @previous IS NULL THROW 50003,'Voucher not found',1;
      IF @previous<>'Active' THROW 50004,'Voucher is no longer active',1;
      DECLARE @next nvarchar(10)=CASE WHEN @location<>@requestedLocation THEN 'Active' WHEN @outcome='Invalid' THEN 'Invalid' ELSE 'Used' END;
      DECLARE @finding nvarchar(2400)=CASE WHEN @location<>@requestedLocation THEN CONCAT('Location mismatch: voucher is for ',@location,'; requested at ',@requestedLocation,'. ',@findingInput) ELSE @findingInput END;
      UPDATE monitoring.Vouchers SET status=@next,ticketReference=@ticket,personInvolved=@person,client=@client,device=@device,purpose=@purpose,
        durationHours=@duration,requestedLocation=@requestedLocation,finding=@finding,occurredAt=@occurredAt,updatedBy=@actor,updatedAt=SYSUTCDATETIME() WHERE id=@id;
      INSERT monitoring.VoucherHistory(voucherId,action,status,note,details,actorId) VALUES(@id,CASE WHEN @next='Active' THEN 'Location mismatch' WHEN @outcome='Invalid' THEN 'Finding recorded' ELSE 'Use attempted' END,@next,@finding,@details,@actor);
      COMMIT; SELECT * FROM monitoring.Vouchers WHERE id=@id;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`,{
      id:{type:sql.Int,value:id},outcome:{type:sql.NVarChar(10),value:b.outcome},requestedLocation:{type:sql.NVarChar(20),value:b.requestedLocation},
      ticket:{type:sql.NVarChar(80),value:b.ticketReference.trim()},person:{type:sql.NVarChar(160),value:b.personInvolved.trim()},client:{type:sql.NVarChar(160),value:b.client.trim()},
      device:{type:sql.NVarChar(160),value:b.device.trim()},purpose:{type:sql.NVarChar(2000),value:b.purpose.trim()},duration:{type:sql.Decimal(8,2),value:b.durationHours??null},
      findingInput:{type:sql.NVarChar(2000),value:b.finding.trim()},occurredAt:{type:sql.DateTime2,value:new Date(b.occurredAt)},actor:{type:sql.NVarChar(128),value:String(req.user.userId)},details:{type:sql.NVarChar(sql.MAX),value:JSON.stringify({ticketReference:b.ticketReference,personInvolved:b.personInvolved,client:b.client,device:b.device,purpose:b.purpose,durationHours:b.durationHours,requestedLocation:b.requestedLocation,occurredAt:b.occurredAt})}
    });
    res.json(result.recordset[0]);
  });
  // Host restricts status writes to developers/testers/leads at router middleware level.
  r.patch('/tasks/:id/status', async (req, res) => {
    if (!req.user?.userId) return res.status(401).json({ error: 'Host user context is required' });
    const id = Number(req.params.id), status = req.body?.status;
    if (!Number.isSafeInteger(id) || id < 1 || !statuses.includes(status)) return res.status(400).json({ error: 'Invalid task or status' });
    const result = await query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      UPDATE monitoring.Tasks SET status=@status,updatedBy=@actor,updatedAt=SYSUTCDATETIME(),
      completedAt=CASE WHEN @status IN ('Prod live','Closed') THEN COALESCE(completedAt,SYSUTCDATETIME()) ELSE NULL END WHERE id=@id;
      IF @@ROWCOUNT=0 THROW 50001, 'Task not found', 1;
      INSERT monitoring.TaskHistory(taskId,actorId,status,notes) VALUES(@id,@actor,@status,@note);
      COMMIT; SELECT id,status,updatedAt,completedAt FROM monitoring.Tasks WHERE id=@id;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`, {
      id: { type: sql.Int, value: id }, status: { type: sql.NVarChar(30), value: status },
      actor: { type: sql.NVarChar(128), value: String(req.user.userId) }, note: { type: sql.NVarChar(8000), value: `Status changed to ${status}` }
    });
    res.json(result.recordset[0]);
  });
  r.get('/deployments', async (req, res) => {
    const result = await query(`SELECT d.*,t.title,t.reference,t.type,t.system FROM monitoring.Deployments d
      INNER JOIN monitoring.Tasks t ON d.taskId=t.id ORDER BY d.occurredAt DESC,d.id DESC`);
    res.json(result.recordset.map(event => ({ ...event, taskNumber: formatTaskNumber(event) })));
  });
  // Host restricts production log writes (including reverts) to release managers/team leads.
  r.post('/deployments', async (req, res) => {
    if (!req.user?.userId) return res.status(401).json({ error: 'Host user context is required' });
    const b = req.body;
    if (!validDeployment(b)) return res.status(400).json({ error: 'Select a task, event, date, release version, and notes. Reverts must reference a deployment.' });
    const result = await query(`SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      IF NOT EXISTS(SELECT 1 FROM monitoring.Tasks WHERE id=@taskId) THROW 50001, 'Task not found', 1;
      IF @action='Revert' AND NOT EXISTS(SELECT 1 FROM monitoring.Deployments WITH(UPDLOCK,HOLDLOCK)
        WHERE id=@revertsId AND taskId=@taskId AND action IN ('Deployment','Fix') AND occurredAt<=@occurredAt)
        THROW 50002, 'Invalid revert target or date', 1;
      INSERT monitoring.Deployments(taskId,action,version,notes,occurredAt,actorId,revertsId)
      OUTPUT INSERTED.id VALUES(@taskId,@action,@version,@notes,@occurredAt,@actor,@revertsId);
      COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH`, {
      taskId: { type: sql.Int, value: b.taskId }, action: { type: sql.NVarChar(20), value: b.action },
      version: { type: sql.NVarChar(120), value: b.version.trim() }, notes: { type: sql.NVarChar(8000), value: b.notes.trim() },
      occurredAt: { type: sql.DateTime2, value: new Date(b.occurredAt) }, actor: { type: sql.NVarChar(128), value: String(req.user.userId) },
      revertsId: { type: sql.Int, value: b.revertsId ?? null }
    });
    res.status(201).json(result.recordset[0]);
  });
  async function save(req, res) {
    const b = req.body || {};
    if (!req.user?.userId) return res.status(401).json({ error: 'Host user context is required' });
    const id = req.params.id ? Number(req.params.id) : null;
    const validId = v => v == null || (typeof v === 'string' && v.length > 0 && v.length <= 128);
    if ((id !== null && (!Number.isSafeInteger(id) || id < 1)) || typeof b.title !== 'string' || !b.title.trim() || b.title.length > 240 ||
      !['Bug', 'Enhancement'].includes(b.type) || !statuses.includes(b.status) || !priorities.includes(b.priority) ||
      !validId(b.developerId) || !validId(b.testerId) || typeof b.description !== 'string' || b.description.length > 8000 ||
      typeof b.notes !== 'string' || b.notes.length > 8000 || typeof b.system !== 'string' || b.system.length > 100 || !validTaskModule(b.moduleName) || (id===null && !taskSystems.includes(b.system)) ||
      typeof b.reference !== 'string' || b.reference.length > 80 || !validRelatedTickets(b.relatedTickets) ||
      (b.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) || Number.isNaN(Date.parse(b.dueDate)))) ||
      (b.estimateHours != null && (!Number.isFinite(b.estimateHours) || b.estimateHours < 0 || b.estimateHours > 9999))) {
      return res.status(400).json({ error: 'Check required fields, assignments, dates, and field lengths' });
    }
    const params = {
      id: { type: sql.Int, value: id }, title: { type: sql.NVarChar(240), value: b.title.trim() },
      type: { type: sql.NVarChar(20), value: b.type }, status: { type: sql.NVarChar(30), value: b.status },
      priority: { type: sql.NVarChar(10), value: b.priority }, description: { type: sql.NVarChar(8000), value: b.description },
      notes: { type: sql.NVarChar(8000), value: b.notes }, system: { type: sql.NVarChar(100), value: b.system },
      reference: { type: sql.NVarChar(80), value: b.reference }, developerId: { type: sql.NVarChar(128), value: b.developerId || null },
      testerId: { type: sql.NVarChar(128), value: b.testerId || null }, dueDate: { type: sql.Date, value: b.dueDate || null },
      estimateHours: { type: sql.Decimal(7, 2), value: b.estimateHours ?? null }, actor: { type: sql.NVarChar(128), value: String(req.user.userId) },
      relatedTickets:{type:sql.NVarChar(sql.MAX),value:b.relatedTickets === undefined ? null : JSON.stringify([...new Set(b.relatedTickets.map(reference=>reference.trim()))])},
      moduleName:{type:sql.NVarChar(120),value:b.moduleName===undefined?null:b.moduleName.trim()},allowedSystems:{type:sql.NVarChar(sql.MAX),value:JSON.stringify(taskSystems)}
    };
    const result = await query(`SET XACT_ABORT ON;
      BEGIN TRY
      BEGIN TRANSACTION;
      IF NOT EXISTS(SELECT 1 FROM OPENJSON(@allowedSystems) WHERE value=@system)
        AND (@id IS NULL OR NOT EXISTS(SELECT 1 FROM monitoring.Tasks WITH(UPDLOCK,HOLDLOCK) WHERE id=@id AND system=@system))
        THROW 50007,'Choose a supported system; existing legacy values may only be preserved unchanged',1;
      IF @id IS NULL BEGIN
        INSERT monitoring.Tasks (title,type,status,priority,description,notes,system,reference,developerId,testerId,dueDate,estimateHours,createdBy,updatedBy,completedAt,relatedTickets,moduleName)
        VALUES (@title,@type,@status,@priority,@description,@notes,@system,@reference,@developerId,@testerId,@dueDate,@estimateHours,@actor,@actor,CASE WHEN @status IN ('Prod live','Closed') THEN SYSUTCDATETIME() ELSE NULL END,COALESCE(@relatedTickets,'[]'),COALESCE(@moduleName,''));
        SET @id = SCOPE_IDENTITY();
      END ELSE BEGIN
        UPDATE monitoring.Tasks SET title=@title,type=@type,status=@status,priority=@priority,description=@description,notes=@notes,system=@system,
        reference=@reference,developerId=@developerId,testerId=@testerId,dueDate=@dueDate,estimateHours=@estimateHours,
        moduleName=COALESCE(@moduleName,moduleName),relatedTickets=COALESCE(@relatedTickets,relatedTickets),updatedBy=@actor,updatedAt=SYSUTCDATETIME(),completedAt=CASE WHEN @status IN ('Prod live','Closed') THEN COALESCE(completedAt,SYSUTCDATETIME()) ELSE NULL END WHERE id=@id;
        IF @@ROWCOUNT = 0 THROW 50001, 'Task not found', 1;
      END;
      INSERT monitoring.TaskHistory (taskId,actorId,status,notes) VALUES (@id,@actor,@status,@notes);
      COMMIT;
      SELECT @id AS id;
      END TRY BEGIN CATCH
      IF @@TRANCOUNT > 0 ROLLBACK;
      THROW;
      END CATCH`, params);
    res.status(id ? 200 : 201).json(result.recordset[0]);
  }
  r.use((error, req, res, next) => {
    if(error.number===50003) return res.status(404).json({error:'Voucher not found'});
    if(error.number===50004) return res.status(409).json({error:'Voucher is no longer active. Refresh the inventory.'});
    if(error.number===50005) return res.status(409).json({error:'Only a location-mismatch voucher can be returned to active inventory'});
    if(error.number===50006) return res.status(400).json({error:'Recurrences require a Bug task, a date on or after task creation, and an optional production event at or before that date'});
    if(error.number===50007) return res.status(400).json({error:'Choose WMS, Client Portal, RF Barcoding, PISA, CMMS or TOLL'});
    if([2601,2627].includes(error.number) && req.path.startsWith('/vouchers')) return res.status(409).json({error:'This voucher code already exists'});
    if (error.number === 50001) return res.status(404).json({ error: 'Task not found' });
    if ([50002,2601,2627].includes(error.number)) return res.status(409).json({ error: 'Invalid revert date/target, or this deployment already has a revert log.' });
    if (error.number === 547) return res.status(400).json({ error: 'Assignment does not match a registered person' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    console.error('Monitoring request failed:', error.code || error.name);
    res.status(503).json({ error: 'Database unavailable. Check SQL configuration and apply the migrations.' });
  });
  return r;
}
