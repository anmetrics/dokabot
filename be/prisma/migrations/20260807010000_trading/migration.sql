-- Trading tables (Phase 2). See docs/ARCHITECTURE.md §2.3
--
-- Money columns are DECIMAL(38,18), not DOUBLE: a rounding error here is a real
-- order for the wrong size.

CREATE TABLE `bots` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `exchange_account_id` VARCHAR(191) NOT NULL,
    `strategy_key` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `timeframe` VARCHAR(191) NOT NULL,
    `config` JSON NOT NULL,
    `status` ENUM('DRAFT', 'RUNNING', 'PAUSED', 'STOPPED', 'ERROR') NOT NULL DEFAULT 'DRAFT',
    `shard_id` INTEGER NOT NULL DEFAULT 0,
    `is_paper` BOOLEAN NOT NULL DEFAULT true,
    `max_loss_usd` DECIMAL(38, 18) NULL,
    `last_error` TEXT NULL,
    `last_signal_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `bots_user_id_idx`(`user_id`),
    INDEX `bots_status_shard_id_idx`(`status`, `shard_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `bot_id` VARCHAR(191) NULL,
    `exchange_account_id` VARCHAR(191) NOT NULL,
    `exchange` ENUM('BINANCE', 'BYBIT') NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `side` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `client_order_id` VARCHAR(191) NOT NULL,
    `exchange_order_id` VARCHAR(191) NULL,
    `price` DECIMAL(38, 18) NOT NULL DEFAULT 0,
    `quantity` DECIMAL(38, 18) NOT NULL,
    `filled_quantity` DECIMAL(38, 18) NOT NULL DEFAULT 0,
    `average_price` DECIMAL(38, 18) NOT NULL DEFAULT 0,
    `state` ENUM('PENDING', 'NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `is_paper` BOOLEAN NOT NULL DEFAULT false,
    `last_error` TEXT NULL,
    `raw` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    -- The idempotency guarantee is enforced by the database, not by application code.
    UNIQUE INDEX `orders_client_order_id_key`(`client_order_id`),
    INDEX `orders_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `orders_bot_id_created_at_idx`(`bot_id`, `created_at`),
    INDEX `orders_state_idx`(`state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bots` ADD CONSTRAINT `bots_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: an API key must not be deletable out from under a
-- running bot.
ALTER TABLE `bots` ADD CONSTRAINT `bots_exchange_account_id_fkey`
    FOREIGN KEY (`exchange_account_id`) REFERENCES `exchange_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL: deleting a bot must never erase its order history.
ALTER TABLE `orders` ADD CONSTRAINT `orders_bot_id_fkey`
    FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
