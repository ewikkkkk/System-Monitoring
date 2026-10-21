-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.TaskHistory. Append-only status and progress snapshots.
CREATE TABLE monitoring.TaskHistory (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 taskId int NOT NULL REFERENCES monitoring.Tasks(id),
 actorId nvarchar(128) NOT NULL,
 status nvarchar(30) NOT NULL,
 notes nvarchar(8000) NOT NULL,
 changedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_MonitoringHistory_task ON monitoring.TaskHistory(taskId,changedAt);
