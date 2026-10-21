-- Database: the METS Hub application database selected by the deployment operator.
-- Schema: monitoring. Creates only the module namespace; no database is created.
IF SCHEMA_ID(N'monitoring') IS NULL EXEC(N'CREATE SCHEMA monitoring');
