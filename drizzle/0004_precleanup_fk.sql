-- Pre-cleanup for foreign key constraints: remove orphan rows

-- lab_reservations: remove rows where userId or labId doesn't exist
DELETE FROM `lab_reservations`
WHERE `userId` NOT IN (SELECT `id` FROM `users`)
   OR `labId` NOT IN (SELECT `id` FROM `lab_rooms`);

-- notifications: remove rows with non-existent user
DELETE FROM `notifications`
WHERE `userId` NOT IN (SELECT `id` FROM `users`);

-- approval_histories: remove rows with non-existent approver
DELETE FROM `approval_histories`
WHERE `approverUserId` NOT IN (SELECT `id` FROM `users`);

-- lab_devices: remove rows with non-existent lab
DELETE FROM `lab_devices`
WHERE `labId` NOT IN (SELECT `id` FROM `lab_rooms`);
