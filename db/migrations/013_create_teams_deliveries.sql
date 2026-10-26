-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.TeamsDeliveries. Teams report delivery audit and duplicate-send guard.
CREATE TABLE monitoring.TeamsDeliveries (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 reportId int NOT NULL REFERENCES monitoring.TicketReports(id),
 destinationKey char(64) NOT NULL,
 destinationName nvarchar(200) NOT NULL,
 previewHash char(64) NOT NULL,
 status nvarchar(12) NOT NULL CHECK(status IN ('Sending','Sent','Failed','Unknown')),
 messageId nvarchar(200) NULL,
 error nvarchar(1000) NOT NULL DEFAULT '',
 actorId nvarchar(128) NOT NULL,
 attempts int NOT NULL DEFAULT 1,
 createdAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 completedAt datetime2 NULL,
 CONSTRAINT UQ_MonitoringTeamsDelivery UNIQUE(reportId,destinationKey)
);
