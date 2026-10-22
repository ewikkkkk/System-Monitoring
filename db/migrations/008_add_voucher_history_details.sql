-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.VoucherHistory. Keep each usage attempt's metadata when a voucher is reused.
ALTER TABLE monitoring.VoucherHistory ADD details nvarchar(max) NULL
 CONSTRAINT CK_MonitoringVoucherHistory_details CHECK(details IS NULL OR ISJSON(details)=1);
