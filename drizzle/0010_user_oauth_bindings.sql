CREATE TABLE IF NOT EXISTS `user_oauth_bindings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `provider` enum('qq','github','school','manus') NOT NULL,
  `providerUserId` varchar(128) NOT NULL,
  `providerEmail` varchar(320),
  `providerName` varchar(255),
  `accessToken` text,
  `refreshToken` text,
  `tokenExpiresAt` timestamp,
  `bindAt` timestamp NOT NULL DEFAULT (now()),
  `lastUsedAt` timestamp,
  `status` enum('active','unbound') NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_oauth_bindings_id` PRIMARY KEY(`id`)
);

CREATE UNIQUE INDEX `uq_oauth_provider_user`
  ON `user_oauth_bindings` (`provider`, `providerUserId`);

CREATE INDEX `idx_oauth_user`
  ON `user_oauth_bindings` (`userId`);

ALTER TABLE `user_oauth_bindings`
  ADD CONSTRAINT `fk_oauth_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
