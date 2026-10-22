import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createSystemMonitoringRouter } from './index.js';
import { createDevPool } from './db/pool.js';
import { fileURLToPath } from 'node:url';

let poolPromise;
const getPool = () => {
  if (!process.env.SQL_SERVER || !process.env.SQL_DATABASE) throw new Error('SQL configuration missing');
  poolPromise ??= createDevPool({ server: process.env.SQL_SERVER, database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: process.env.SQL_TRUST_CERTIFICATE === 'true' }
  }).catch(error => { poolPromise = undefined; throw error; });
  return poolPromise;
};
const app = express();
const demo = process.argv.includes('--demo');
let router;
if (demo) {
  const { createDemoStore } = await import('./demo/store.js');
  const { createDemoMonitoringRouter } = await import('./demo/router.js');
  const store = await createDemoStore(fileURLToPath(new URL('../.local/monitoring-demo.json', import.meta.url)));
  router = createDemoMonitoringRouter(store);
} else router = createSystemMonitoringRouter(getPool);
// Development identity supplied by the local host, never by the HTTP client.
app.use('/api/system-monitoring', (req, res, next) => {
  const userId = demo ? 'demo-local-user' : process.env.DEV_USER_ID;
  if (userId) req.user = { userId };
  next();
}, router);
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
app.use(vite.middlewares);
const port = Number(process.env.PORT || 5173);
app.listen(port, '127.0.0.1', () => console.log(`System Monitoring${demo ? ' (DEMO — local file database)' : ''}: http://127.0.0.1:${port}`));
