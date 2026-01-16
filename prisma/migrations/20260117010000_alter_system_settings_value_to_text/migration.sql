-- Increase system_settings.value storage to support JSON settings such as system_write_lock.
-- Previously MySQL default VARCHAR(191) could overflow and crash upserts.

ALTER TABLE `system_settings`
  MODIFY `value` TEXT NOT NULL;

