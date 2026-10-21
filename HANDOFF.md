## 1. Which database, and which schema/tables does it read and write?
Database name is not supplied yet. Use the METS Hub application database; apply numbered migrations 001–004 in order with a migration ledger owned by the host. Schema: monitoring. Reads People, Tasks, TaskHistory; writes Tasks and TaskHistory. People must be provisioned from the host directory by an operator. No sample people or tickets are inserted.

## 2. Which env vars does it need? NAMES ONLY — never values, never a password.
SQL_SERVER
SQL_DATABASE
SQL_USER
SQL_PASSWORD
SQL_TRUST_CERTIFICATE
DEV_USER_ID
PORT

## 3. Does it need its own SQL login, or the app's main one?
Use the app's main login with SELECT on the three module tables and INSERT/UPDATE on Tasks, INSERT on TaskHistory. Migrations and People provisioning require a separate operator with appropriate permissions. Integrated code receives the host pool getter; SQL environment variables are local development only.

## 4. What is unfinished, stubbed, or returning a fake number? Be blunt.
Real SQL Server target and credentials are not provided. Migrations have not been applied. Real database acceptance is not passed. No fake counts or demo rows. People synchronization must be supplied by the hub; there is no directory-management UI. No imports, attachments, notifications, deletion, or AI features. History records status/notes and acting user on each save, not every field-level diff. Concurrent edits use last-write-wins. Local developer identity requires DEV_USER_ID; production identity must come from the host. Build/start checks are tracked in README.

## 5. Which routes must be restricted, and to whom?
All /api/system-monitoring routes require authenticated monitoring-team access at router level. GET /tasks, GET /people, GET /tasks/:id/history: authorized monitoring viewers. POST /tasks and PUT /tasks/:id: developers, testers, and team leads. Apply method-level policy in host router middleware. No client identity or local authorization tables are accepted.
