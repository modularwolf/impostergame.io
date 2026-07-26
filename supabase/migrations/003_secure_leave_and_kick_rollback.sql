-- Drops the two new functions added in 003_secure_leave_and_kick.sql.
-- Safe as long as the web client's App.tsx has been reverted to call
-- leave_room / kick_room_player (the originals, untouched by this
-- migration) before or at the same time as this rollback runs.

drop function if exists public.leave_room_secure(text, text);
drop function if exists public.kick_room_player_secure(text, text, text);
