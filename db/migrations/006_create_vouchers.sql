-- Database: the METS Hub application database selected by the deployment operator.
-- Schema/table: monitoring.Vouchers. Network voucher inventory and terminal usage/finding details.
CREATE TABLE monitoring.Vouchers (
 id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
 code nvarchar(120) NOT NULL UNIQUE,
 location nvarchar(20) NOT NULL CHECK(location IN ('Bancal 1','Bancal 2')),
 status nvarchar(10) NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Used','Invalid')),
 ticketReference nvarchar(80) NOT NULL DEFAULT '',
 personInvolved nvarchar(160) NOT NULL DEFAULT '',
 client nvarchar(160) NOT NULL DEFAULT '',
 device nvarchar(160) NOT NULL DEFAULT '',
 purpose nvarchar(2000) NOT NULL DEFAULT '',
 durationHours decimal(8,2) NULL CHECK(durationHours>0 AND durationHours<=8760),
 requestedLocation nvarchar(20) NULL CHECK(requestedLocation IN ('Bancal 1','Bancal 2')),
 finding nvarchar(2400) NOT NULL DEFAULT '',
 occurredAt datetime2 NULL,
 createdAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 updatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 createdBy nvarchar(128) NOT NULL,
 updatedBy nvarchar(128) NOT NULL
);
CREATE INDEX IX_MonitoringVoucher_status ON monitoring.Vouchers(status,location);
