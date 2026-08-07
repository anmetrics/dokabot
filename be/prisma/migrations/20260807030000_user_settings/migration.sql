-- Per-user settings. Replaces the global `settings` key/value table, which had
-- one hardcoded row per coin and could only describe a single tenant.

CREATE TABLE `user_settings` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `default_order_size_usd` DECIMAL(38, 18) NOT NULL DEFAULT 50,
    `default_take_profit_percent` DECIMAL(10, 4) NOT NULL DEFAULT 2,
    `default_stop_loss_percent` DECIMAL(10, 4) NOT NULL DEFAULT 1,
    `default_max_loss_usd` DECIMAL(38, 18) NULL,
    `max_concurrent_bots` INTEGER NOT NULL DEFAULT 20,
    `max_daily_loss_usd` DECIMAL(38, 18) NULL,
    `trading_paused` BOOLEAN NOT NULL DEFAULT false,
    `symbol_rules` JSON NOT NULL,
    `notify_on_fill` BOOLEAN NOT NULL DEFAULT true,
    `notify_on_error` BOOLEAN NOT NULL DEFAULT true,
    `notify_on_bot_stopped` BOOLEAN NOT NULL DEFAULT true,
    `telegram_chat_id` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    `locale` VARCHAR(191) NOT NULL DEFAULT 'vi',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `user_settings_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
