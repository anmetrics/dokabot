-- AlterTable
ALTER TABLE `positions` ADD COLUMN `is_dual_investment` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sell_price` DOUBLE NULL;
