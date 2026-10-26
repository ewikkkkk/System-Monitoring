import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createSystemMonitoringRouter } from './index.js';
import { createDevPool } from './db/pool.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createTeamsService } from './teams/graph.js';
import { getReportTicketUrl } from '../src/services/api.js';

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
// Optional local-only setup. Production uses the host's per-user delegated token getter.
if(process.env.TEAMS_CHAT_ID&&process.env.TEAMS_CHAT_NAME&&process.env.TEAMS_GRAPH_ACCESS_TOKEN){
  let aliases={};try{aliases=JSON.parse(await readFile(new URL('../.local/teams-assignees.json',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  app.locals.systemMonitoringTeams=createTeamsService({getAccessToken:async()=>process.env.TEAMS_GRAPH_ACCESS_TOKEN,destinations:[{id:'daily-reports',name:process.env.TEAMS_CHAT_NAME,chatId:process.env.TEAMS_CHAT_ID}],aliases,resolveTicketUrl:getReportTicketUrl});
}
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
