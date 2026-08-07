-- Multi-tenant foundation (Phase 1). See docs/ARCHITECTURE.md §2.5
--
-- `user_id` is added as NULLable on the pre-existing tables so the migration is
-- safe on live data. Backfill and a NOT NULL tightening follow in Phase 2.

CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `mfa_secret` VARCHAR(191) NULL,
    `mfa_enabled` BOOLEAN NOT NULL DEFAULT false,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `user_agent` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `exchange_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `exchange` ENUM('BINANCE', 'BYBIT') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `api_key_ciphertext` TEXT NOT NULL,
    `api_key_last4` VARCHAR(191) NOT NULL,
    `secret_ciphertext` TEXT NOT NULL,
    `iv` VARCHAR(191) NOT NULL,
    `auth_tag` VARCHAR(191) NOT NULL,
    `wrapped_dek` TEXT NOT NULL,
    `kms_key_id` VARCHAR(191) NOT NULL,
    `is_testnet` BOOLEAN NOT NULL DEFAULT false,
    `permissions` JSON NULL,
    `can_withdraw` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'INVALID', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `last_verified_at` DATETIME(3) NULL,
    `last_error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `exchange_accounts_user_id_idx`(`user_id`),
    UNIQUE INDEX `exchange_accounts_user_id_exchange_label_key`(`user_id`, `exchange`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `resource_type` VARCHAR(191) NULL,
    `resource_id` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `metadata` JSON NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `positions` ADD COLUMN `user_id` VARCHAR(191) NULL;
CREATE INDEX `positions_user_id_idx` ON `positions`(`user_id`);

ALTER TABLE `sell_successes` ADD COLUMN `user_id` VARCHAR(191) NULL;
CREATE INDEX `sell_successes_user_id_idx` ON `sell_successes`(`user_id`);

ALTER TABLE `sideway_scenarios` ADD COLUMN `user_id` VARCHAR(191) NULL;
CREATE INDEX `sideway_scenarios_user_id_idx` ON `sideway_scenarios`(`user_id`);

ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `exchange_accounts` ADD CONSTRAINT `exchange_accounts_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
