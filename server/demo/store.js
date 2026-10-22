// Local-only, file-backed demo database. Never imported by the production router.
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function createDemoStore(file) {
  let state;
  try { state = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const now = new Date().toISOString();
    const people = [
      { userId: 'demo-alex', displayName: 'Alex Rivera', assignmentRole: 'developer' },
      { userId: 'demo-jamie', displayName: 'Jamie Chen', assignmentRole: 'developer' },
      { userId: 'demo-sam', displayName: 'Sam Patel', assignmentRole: 'tester' },
      { userId: 'demo-morgan', displayName: 'Morgan Lee', assignmentRole: 'both' }
    ];
    const examples = [
      ['Investigate duplicate inventory adjustments', 'Bug', 'Open', 'High', 'Inventory'],
      ['Add batch selection to outbound picking', 'Enhancement', 'In progress', 'Normal', 'Warehouse'],
      ['Fix incorrect totals on the stock report', 'Bug', 'In testing', 'High', 'Reporting'],
      ['Add shipment reference search', 'Enhancement', 'Ready for release', 'Normal', 'Shipping'],
      ['Resolve intermittent barcode scan timeout', 'Bug', 'Prod live', 'Urgent', 'Warehouse'],
      ['Improve purchase order validation messages', 'Enhancement', 'Closed', 'Low', 'Purchasing']
    ];
    state = { people, tasks: examples.map(([title, type, status, priority, system], i) => ({
      id: i + 1, title, type, status, priority, system, reference: `DEMO-${1001 + i}`,
      description: 'Sample task for exploring the monitoring workflow. Replace with your own task details.',
      notes: 'Demo record — not a real production ticket.', developerId: people[i % 2].userId,
      testerId: 'demo-sam', dueDate: null, estimateHours: 4 + i, createdBy: 'demo-local-user',
      updatedBy: 'demo-local-user', createdAt: now, updatedAt: now,
      completedAt: ['Prod live', 'Closed'].includes(status) ? now : null
    })), history: [] };
    state.history = state.tasks.map(t => ({ id: t.id, taskId: t.id, actorId: 'demo-local-user', status: t.status, notes: t.notes, changedAt: now }));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(state, null, 2), { flag: 'wx' });
  }
  let pending = Promise.resolve();
  return {
    snapshot: () => structuredClone(state),
    update(change) {
      const result = pending.then(async () => {
        const next = structuredClone(state);
        const value = change(next);
        await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2));
        await rename(`${file}.tmp`, file);
        state = next;
        return value;
      });
      pending = result.catch(() => {});
      return result;
    }
  };
}
