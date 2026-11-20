-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.Vouchers. Add Maguyam as an allowed physical voucher location.
DECLARE @locationConstraint sysname = (
  SELECT name FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'monitoring.Vouchers')
    AND definition LIKE N'%Bancal 1%'
    AND definition LIKE N'%location%'
    AND definition NOT LIKE N'%requestedLocation%'
);
IF @locationConstraint IS NOT NULL
  EXEC(N'ALTER TABLE monitoring.Vouchers DROP CONSTRAINT ' + QUOTENAME(@locationConstraint));
ALTER TABLE monitoring.Vouchers ADD CONSTRAINT CK_MonitoringVouchers_location
  CHECK (location IN ('Bancal 1', 'Bancal 2', 'Maguyam'));

DECLARE @requestedLocationConstraint sysname = (
  SELECT name FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'monitoring.Vouchers')
    AND definition LIKE N'%requestedLocation%'
);
IF @requestedLocationConstraint IS NOT NULL
  EXEC(N'ALTER TABLE monitoring.Vouchers DROP CONSTRAINT ' + QUOTENAME(@requestedLocationConstraint));
ALTER TABLE monitoring.Vouchers ADD CONSTRAINT CK_MonitoringVouchers_requestedLocation
  CHECK (requestedLocation IS NULL OR requestedLocation IN ('Bancal 1', 'Bancal 2', 'Maguyam'));
