import { Router, json } from 'express';
import { query, sql, withPool } from './db/pool.js';
import { validDeployment } from './deployment-validation.js';
import { formatTaskNumber } from '../shared/task-number.js';

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
    res.json(result.recordset.map(task => ({ ...task, taskNumber: formatTaskNumber(task) })));
  });
  r.get('/tasks/:id/history', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid task ID' });
    const result = await query('SELECT * FROM monitoring.TaskHistory WHERE taskId = @id ORDER BY changedAt DESC, id DESC', { id: { type: sql.Int, value: id } });
    res.json(result.recordset);
  });
  r.put('/tasks/:id', save);
  r.post('/tasks', save);
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
      typeof b.notes !== 'string' || b.notes.length > 8000 || typeof b.system !== 'string' || b.system.length > 100 ||
      typeof b.reference !== 'string' || b.reference.length > 80 ||
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
      estimateHours: { type: sql.Decimal(7, 2), value: b.estimateHours ?? null }, actor: { type: sql.NVarChar(128), value: String(req.user.userId) }
    };
    const result = await query(`SET XACT_ABORT ON;
      BEGIN TRY
      BEGIN TRANSACTION;
      IF @id IS NULL BEGIN
        INSERT monitoring.Tasks (title,type,status,priority,description,notes,system,reference,developerId,testerId,dueDate,estimateHours,createdBy,updatedBy,completedAt)
        VALUES (@title,@type,@status,@priority,@description,@notes,@system,@reference,@developerId,@testerId,@dueDate,@estimateHours,@actor,@actor,CASE WHEN @status IN ('Prod live','Closed') THEN SYSUTCDATETIME() ELSE NULL END);
        SET @id = SCOPE_IDENTITY();
      END ELSE BEGIN
        UPDATE monitoring.Tasks SET title=@title,type=@type,status=@status,priority=@priority,description=@description,notes=@notes,system=@system,
        reference=@reference,developerId=@developerId,testerId=@testerId,dueDate=@dueDate,estimateHours=@estimateHours,
        updatedBy=@actor,updatedAt=SYSUTCDATETIME(),completedAt=CASE WHEN @status IN ('Prod live','Closed') THEN COALESCE(completedAt,SYSUTCDATETIME()) ELSE NULL END WHERE id=@id;
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
    if (error.number === 50001) return res.status(404).json({ error: 'Task not found' });
    if ([50002,2601,2627].includes(error.number)) return res.status(409).json({ error: 'Invalid revert date/target, or this deployment already has a revert log.' });
    if (error.number === 547) return res.status(400).json({ error: 'Assignment does not match a registered person' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    console.error('Monitoring request failed:', error.code || error.name);
    res.status(503).json({ error: 'Database unavailable. Check SQL configuration and apply the migrations.' });
  });
  return r;
}
