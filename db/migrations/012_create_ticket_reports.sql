-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.TicketReports. Append-only imported daily report snapshots.
CREATE TABLE monitoring.TicketReports (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 requestId uniqueidentifier NOT NULL UNIQUE,
 reportDate date NOT NULL,
 asOfTime char(5) NOT NULL,
 timeZone nvarchar(80) NOT NULL,
 sourceName nvarchar(200) NOT NULL,
 sheetName nvarchar(100) NOT NULL,
 total int NOT NULL,
 unfinished int NOT NULL,
 openCount int NOT NULL,
 waiting int NOT NULL,
 pending int NOT NULL,
 internalCount int NOT NULL,
 resolved int NOT NULL,
 closed int NOT NULL,
 overdue int NOT NULL,
 snapshotJson nvarchar(max) NOT NULL CHECK (ISJSON(snapshotJson)=1),
 actorId nvarchar(128) NOT NULL,
 createdAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_MonitoringTicketReports_date ON monitoring.TicketReports(reportDate DESC,asOfTime DESC,id DESC);
