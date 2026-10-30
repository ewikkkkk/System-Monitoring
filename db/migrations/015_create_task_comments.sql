-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.TaskComments. Conversation authors come from host req.user.userId.
CREATE TABLE monitoring.TaskComments (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 taskId int NOT NULL REFERENCES monitoring.Tasks(id),
 actorId nvarchar(128) NOT NULL,
 body nvarchar(4000) NOT NULL,
 requestId uniqueidentifier NOT NULL UNIQUE,
 createdAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 editedAt datetime2 NULL
);
CREATE INDEX IX_TaskComments_task ON monitoring.TaskComments(taskId,createdAt,id);
