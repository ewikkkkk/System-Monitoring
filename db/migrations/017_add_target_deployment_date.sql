-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.Tasks. Planned deployment date, distinct from task due date and actual production logs.
ALTER TABLE monitoring.Tasks ADD targetDeploymentDate date NULL;
