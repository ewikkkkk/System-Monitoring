-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.VoucherHistory. Append-only inventory transition audit.
CREATE TABLE monitoring.VoucherHistory (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 voucherId int NOT NULL REFERENCES monitoring.Vouchers(id),
 action nvarchar(20) NOT NULL,
 status nvarchar(10) NOT NULL,
 note nvarchar(2400) NOT NULL,
 actorId nvarchar(128) NOT NULL,
 changedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_MonitoringVoucherHistory_voucher ON monitoring.VoucherHistory(voucherId,changedAt);
