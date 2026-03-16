ALTER TABLE `lab_reservations`
  ADD COLUMN `checkinTime` timestamp NULL,
  ADD COLUMN `checkoutTime` timestamp NULL,
  ADD COLUMN `checkinMethod` enum('qrcode','geofence','face','manual') NULL,
  ADD COLUMN `checkinLatitude` decimal(10,7) NULL,
  ADD COLUMN `checkinLongitude` decimal(10,7) NULL,
  ADD COLUMN `checkinDeviceInfo` varchar(255) NULL;
