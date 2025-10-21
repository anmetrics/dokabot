-- CreateTable
CREATE TABLE `positions` (
    `id` VARCHAR(191) NOT NULL,
    `buy_price` DOUBLE NOT NULL,
    `strategy` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `qty` DOUBLE NOT NULL,
    `usd_spent` DOUBLE NOT NULL,
    `total_qty_actual` DOUBLE NOT NULL,
    `dca_index` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sell_successes` (
    `id` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `buy_prices` JSON NOT NULL,
    `sell_prices` DOUBLE NOT NULL,
    `total_amount_buy_actual` DOUBLE NOT NULL,
    `total_amount_buy_usd_spent` DOUBLE NOT NULL,
    `total_profit` DOUBLE NOT NULL,
    `total_revenue_usdt` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
