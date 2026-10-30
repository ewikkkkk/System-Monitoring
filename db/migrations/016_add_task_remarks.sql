-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.Tasks. Current handoff remarks, separate from conversation history.
ALTER TABLE monitoring.Tasks ADD remarks nvarchar(1000) NOT NULL
 CONSTRAINT DF_Tasks_remarks DEFAULT ('') WITH VALUES;
