-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.Tasks. Store the module separately; existing system values are not remapped.
ALTER TABLE monitoring.Tasks ADD moduleName nvarchar(120) NOT NULL
 CONSTRAINT DF_MonitoringTasks_moduleName DEFAULT '';
