-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.People. Host-provisioned assignment directory, not roles/auth.
CREATE TABLE monitoring.People (
 userId nvarchar(128) NOT NULL PRIMARY KEY,
 displayName nvarchar(160) NOT NULL,
 assignmentRole varchar(10) NOT NULL CHECK (assignmentRole IN ('developer','tester','both')),
 active bit NOT NULL DEFAULT 1
);
