-- Removes the single-tenant tables left over from the personal-bot era.
--
-- `settings` held one global key/value config for the whole process — the model
-- that per-user bot config replaced. `positions`, `sell_successes` and
-- `sideway_scenarios` belonged to the in-process strategy runner that has been
-- superseded by `bots` + `orders`.
--
-- Nothing in the application reads these tables any more. Back them up first if a
-- production database still holds rows worth keeping.

DROP TABLE IF EXISTS `sideway_scenarios`;
DROP TABLE IF EXISTS `sell_successes`;
DROP TABLE IF EXISTS `positions`;
DROP TABLE IF EXISTS `settings`;
