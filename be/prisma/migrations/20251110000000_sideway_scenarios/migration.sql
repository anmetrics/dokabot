-- The SidewayScenario model was added to schema.prisma without a migration, so
-- databases created from the migration history are missing this table. Created
-- here with IF NOT EXISTS so databases that drifted via `db push` stay valid.

CREATE TABLE IF NOT EXISTS `sideway_scenarios` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `qty` DOUBLE NOT NULL,
    `steps` JSON NOT NULL,
    `current_step_index` INTEGER NOT NULL DEFAULT 0,
    `is_loop` BOOLEAN NOT NULL DEFAULT false,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'idle',
    `last_executed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
