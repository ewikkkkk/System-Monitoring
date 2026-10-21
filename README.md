# System Monitoring

React 18 JSX page and Express 5 module for enhancement and bug tracking. No seeded or simulated records.

Run `npm install`, configure SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD and DEV_USER_ID in the process environment, apply db/migrations/001–004 to the selected application database, then run `npm run dev`. Optional SQL_TRUST_CERTIFICATE is for trusted local development certificates only. Open http://127.0.0.1:5173. `npm run build` builds the development frontend.

Migrations are operator-applied, once, in numeric order. The database name remains a deployment choice. Provision monitoring.People with real hub user IDs, display names and assignment roles (developer, tester, both). Assignment roles are directory metadata, never access-control roles.

Integration: mount `createSystemMonitoringRouter(() => pool)` from server/index.js at `/api/system-monitoring` after the hub authentication/authorization middleware. Import the default page from src/SystemMonitoringPage.jsx with `{ darkMode, onToggleDarkMode, onToggleSidebar }`. The page accepts shell callbacks without adding shell controls. Call configureMonitoringAuth from src/services/api.js with an async bearer token getter. Copy server/db/pool.js and the numbered SQL migrations. Discard server/dev-server.js, src/dev.jsx, and index.html. The SQL seam uses AsyncLocalStorage to keep pool getters isolated between concurrent mounts. There is no auth provider, shell, or AI integration.

Verification (2026-10-21): `npm run build` passed; `npm test` passed all three SQL seam checks. The development server started, GET / returned HTTP 200, and the page rendered in the browser. GET /api/system-monitoring/tasks returned the expected HTTP 503 because SQL configuration is absent. Real SQL data acceptance remains blocked until a SQL Server target is configured; migrations and persistence are not yet verified against SQL Server. This Windows sandbox required elevated execution for dependency installation and the Vite development server.
