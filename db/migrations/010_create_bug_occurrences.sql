-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.BugOccurrences. Explicit, append-only recurrence reports; no inferred deployment causality.
CREATE TABLE monitoring.BugOccurrences (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 taskId int NOT NULL REFERENCES monitoring.Tasks(id),
 occurredAt datetime2 NOT NULL,
 reference nvarchar(80) NOT NULL DEFAULT '',
 notes nvarchar(4000) NOT NULL,
 deploymentId int NULL REFERENCES monitoring.Deployments(id),
 recordedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 actorId nvarchar(128) NOT NULL
);
CREATE INDEX IX_MonitoringBugOccurrences_date ON monitoring.BugOccurrences(occurredAt,taskId);
