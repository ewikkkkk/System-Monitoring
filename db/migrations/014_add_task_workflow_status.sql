-- Database: SystemMonitoring (or the host application database selected by the operator).
-- Schema: monitoring. Adds precise workflow status; existing status/check and audit history stay intact.
-- NULL means a pre-workflow row: the API translates its legacy status until its next write.
ALTER TABLE monitoring.Tasks ADD workflowStatus nvarchar(30) NULL
  CONSTRAINT CK_Tasks_workflowStatus CHECK (workflowStatus IN (
    'OPEN','ONGOING DEV','FOR TESTING (DL)','FOR DEPLOYMENT (DL)','DEV LIVE',
    'ONGOING TEST (DL)','BACK TO TECH (DL)','READY','FOR DEPLOYMENT (PL)',
    'MALFUNCTIONING (PL)','FOR MONITORING','PROD LIVE (HYPERCARE)','COMPLETE'));
