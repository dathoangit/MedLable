-- Rotate the HIS role password used by MedLabel.
-- The previous password was committed in .env.example and remains in git
-- history, so changing this file is not enough — the database role must
-- change too.
--
-- Run as a Postgres superuser on the HIS host. Then:
--   1. Put the new password in the server .env only (never commit it).
--   2. Restart the MedLabel Windows service.
--
-- Do not paste the old password into tickets, chat, or git.

ALTER ROLE his_stpaul PASSWORD 'replace-with-a-new-secret';
