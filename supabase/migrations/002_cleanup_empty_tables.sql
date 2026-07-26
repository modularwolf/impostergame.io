-- Drops the two empty leftover tables flagged in the mobile app brief
-- (section 10, phase 1): rooms_backup and rooms_duplicate_v2. Confirmed
-- empty and unreferenced by any function via the schema export on
-- 2026-07-26 — same three columns as `rooms`, nothing in the live function
-- list reads or writes them.
--
-- Low risk, but irreversible in the sense that if either table secretly
-- held something, it's gone after this runs — hence the rollback file
-- recreates the (empty) shape rather than actually restoring data.

drop table if exists public.rooms_backup;
drop table if exists public.rooms_duplicate_v2;
