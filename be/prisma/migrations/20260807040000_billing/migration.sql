-- Subscription billing on BSC. See contracts/README.md

CREATE TABLE `wallet_links` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `chain_id` INTEGER NOT NULL,
    `nonce` VARCHAR(191) NOT NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wallet_links_address_key`(`address`),
    INDEX `wallet_links_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tier` ENUM('FREE', 'PRO') NOT NULL DEFAULT 'FREE',
    `status` ENUM('NONE', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'NONE',
    `wallet_address` VARCHAR(191) NULL,
    `price_usd` DECIMAL(18, 6) NOT NULL DEFAULT 4,
    `current_period_start` DATETIME(3) NULL,
    `current_period_end` DATETIME(3) NULL,
    `grace_ends_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `last_error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `subscriptions_user_id_key`(`user_id`),
    INDEX `subscriptions_status_current_period_end_idx`(`status`, `current_period_end`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tx_hash` VARCHAR(191) NOT NULL,
    `log_index` INTEGER NOT NULL,
    `block_number` BIGINT NOT NULL,
    `wallet_address` VARCHAR(191) NOT NULL,
    `amount_usd` DECIMAL(18, 6) NOT NULL,
    `amount_raw` VARCHAR(191) NOT NULL,
    `charge_count` INTEGER NOT NULL,
    `confirmed_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    -- The log's position on chain, not the user: a reorg can replay a block.
    UNIQUE INDEX `payments_tx_hash_log_index_key`(`tx_hash`, `log_index`),
    INDEX `payments_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `chain_cursors` (
    `id` VARCHAR(191) NOT NULL,
    `chain_id` INTEGER NOT NULL,
    `contract_address` VARCHAR(191) NOT NULL,
    `last_processed_block` BIGINT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `chain_cursors_chain_id_contract_address_key`(`chain_id`, `contract_address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `wallet_links` ADD CONSTRAINT `wallet_links_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payments` ADD CONSTRAINT `payments_subscription_id_fkey`
    FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
