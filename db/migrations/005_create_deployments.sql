-- Database: the application database selected by the deployment operator.
-- Schema/table: monitoring.Deployments. Append-only production event log.
-- Apply after 001-004. A Revert records a rollback; it does not execute one.
CREATE TABLE monitoring.Deployments (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 taskId int NOT NULL REFERENCES monitoring.Tasks(id),
 action nvarchar(20) NOT NULL CHECK (action IN ('Deployment','Fix','Revert')),
 version nvarchar(120) NOT NULL,
 notes nvarchar(8000) NOT NULL,
 occurredAt datetime2 NOT NULL,
 recordedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 actorId nvarchar(128) NOT NULL,
 revertsId int NULL REFERENCES monitoring.Deployments(id),
 CONSTRAINT CK_MonitoringDeployment_revert CHECK (
   (action = 'Revert' AND revertsId IS NOT NULL) OR
   (action IN ('Deployment','Fix') AND revertsId IS NULL)
 )
);
CREATE UNIQUE INDEX UX_MonitoringDeployment_revert ON monitoring.Deployments(revertsId) WHERE revertsId IS NOT NULL;
CREATE INDEX IX_MonitoringDeployment_date ON monitoring.Deployments(occurredAt,taskId);
