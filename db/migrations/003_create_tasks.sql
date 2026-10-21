-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.Tasks. Work register.
CREATE TABLE monitoring.Tasks (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 title nvarchar(240) NOT NULL,
 reference nvarchar(80) NOT NULL DEFAULT '',
 system nvarchar(100) NOT NULL DEFAULT '',
 type nvarchar(20) NOT NULL CHECK (type IN ('Bug','Enhancement')),
 status nvarchar(30) NOT NULL CHECK (status IN ('Open','In progress','In testing','Ready for release','Prod live','Closed')),
 priority nvarchar(10) NOT NULL CHECK (priority IN ('Low','Normal','High','Urgent')),
 description nvarchar(8000) NOT NULL DEFAULT '',
 notes nvarchar(8000) NOT NULL DEFAULT '',
 developerId nvarchar(128) NULL REFERENCES monitoring.People(userId),
 testerId nvarchar(128) NULL REFERENCES monitoring.People(userId),
 dueDate date NULL,
 estimateHours decimal(7,2) NULL CHECK (estimateHours >= 0 AND estimateHours <= 9999),
 createdBy nvarchar(128) NOT NULL,
 updatedBy nvarchar(128) NOT NULL,
 createdAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 updatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 completedAt datetime2 NULL
);
