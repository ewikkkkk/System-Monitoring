import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createSystemMonitoringRouter } from './index.js';
import { createDevPool } from './db/pool.js';

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
// Development identity supplied by the local host, never by the HTTP client.
app.use('/api/system-monitoring', (req, res, next) => { if (process.env.DEV_USER_ID) req.user = { userId: process.env.DEV_USER_ID }; next(); }, createSystemMonitoringRouter(getPool));
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
app.use(vite.middlewares);
app.listen(Number(process.env.PORT || 5173), '127.0.0.1', () => console.log('System Monitoring: http://127.0.0.1:5173'));
