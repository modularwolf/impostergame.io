-- Drops start_round_premium. Safe as long as the client has been reverted
-- to block starting a round with a premium category (both App.tsx and this
-- repo's equivalent) before or at the same time as this rollback runs —
-- otherwise a host selecting a premium category would get a generic RPC-
-- not-found error instead of the current graceful "not available yet" UI
-- state.

drop function if exists public.start_round_premium(text, text, int, text, int, jsonb);
