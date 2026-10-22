-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.Tasks. Additional external Help Desk references for recurring/related concerns.
ALTER TABLE monitoring.Tasks ADD relatedTickets nvarchar(max) NOT NULL
 CONSTRAINT DF_MonitoringTasks_relatedTickets DEFAULT '[]'
 CONSTRAINT CK_MonitoringTasks_relatedTickets CHECK(ISJSON(relatedTickets)=1);
