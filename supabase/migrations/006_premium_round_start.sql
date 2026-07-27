-- Monetization phase 5: actually serve premium words at round start.
--
-- Until now, selecting a premium category in the UI was a dead end — the
-- Start button stayed disabled unconditionally, because there was no way
-- for the client to get a secret word: category_words RLS correctly hides
-- premium rows from anon/authenticated SELECTs regardless of ownership (see
-- 002_categories_database.sql), so the client can never pick a word itself
-- the way it does for free categories.
--
-- This function is the entitlement-checked serving path that mirrors why
-- round_secrets exists in the first place: the secret never touches the
-- client until this function, running as a trusted SECURITY DEFINER role,
-- decides the caller is allowed to see it.
--
-- Differences from start_round_secure:
--   1. Requires auth.uid() to be set — the caller must be signed in. This
--      is NOT anon-callable (see the grant at the bottom); a premium round
--      can only be started by an authenticated request, since there is no
--      other way to know whose entitlements to check.
--   2. Verifies the category is_premium and that the caller owns it via
--      entitlements, before doing anything else.
--   3. Picks the secret word itself from category_words, server-side —
--      the client never supplies p_secret_word here (contrast with
--      start_round_secure, where the client picks from its own fetched
--      free-category word list and passes the choice in). This is the only
--      function in this schema that reads category_words for a premium
--      category; everything else is blocked by RLS.
--
-- Fully additive. Does not modify start_round_secure, so free categories
-- are completely unaffected.
--
-- Safe to run multiple times.

create or replace function public.start_round_premium(
  p_room_code text,
  p_host_id text,
  p_imposter_index int,
  p_category_id text,
  p_starting_index int,
  p_used_words jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_players jsonb;
  v_player_count int;
  v_imposter_id text;
  v_clamped_imposter_idx int;
  v_clamped_starting_idx int;
  v_new_state jsonb;
  v_category record;
  v_owns boolean;
  v_secret_word text;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to start a round with a premium category';
  end if;

  select state into v_state from public.rooms where code = p_room_code for update;
  if v_state is null then
    raise exception 'Room not found';
  end if;

  if (v_state->>'hostPlayerId') is distinct from p_host_id then
    raise exception 'Only the host can start the round';
  end if;

  select id, is_premium, active into v_category
  from public.categories
  where id = p_category_id;

  if v_category.id is null or not v_category.active then
    raise exception 'Category not found';
  end if;
  if not v_category.is_premium then
    raise exception 'start_round_premium is only for premium categories — use start_round_secure';
  end if;

  select exists(
    select 1 from public.entitlements
    where user_id = auth.uid() and category_id = p_category_id
  ) into v_owns;
  if not v_owns then
    raise exception 'You do not own this category';
  end if;

  v_players := v_state->'players';
  v_player_count := jsonb_array_length(v_players);
  if v_player_count < 3 then
    raise exception 'Need at least 3 players';
  end if;

  v_clamped_imposter_idx := least(greatest(p_imposter_index, 0), v_player_count - 1);
  v_clamped_starting_idx := least(greatest(p_starting_index, 0), v_player_count - 1);
  v_imposter_id := v_players -> v_clamped_imposter_idx ->> 'id';

  -- Pick a word not already used in this room if possible, falling back to
  -- any word in the category once the unused pool is exhausted — same
  -- fallback behavior as the client-side pick for free categories.
  select word into v_secret_word
  from public.category_words
  where category_id = p_category_id
    and not (lower(word) = any (
      select jsonb_array_elements_text(coalesce(p_used_words, '[]'::jsonb))
    ))
  order by random()
  limit 1;

  if v_secret_word is null then
    select word into v_secret_word
    from public.category_words
    where category_id = p_category_id
    order by random()
    limit 1;
  end if;

  if v_secret_word is null then
    raise exception 'This category has no words configured';
  end if;

  insert into public.round_secrets (room_code, imposter_player_id, secret_word, updated_at)
  values (p_room_code, v_imposter_id, v_secret_word, now())
  on conflict (room_code) do update
    set imposter_player_id = excluded.imposter_player_id,
        secret_word = excluded.secret_word,
        updated_at = now();

  v_new_state := jsonb_set(v_state, '{stage}', '"game"');
  v_new_state := jsonb_set(v_new_state, '{round}', jsonb_build_object('categoryId', p_category_id));
  v_new_state := jsonb_set(v_new_state, '{turnIndex}', to_jsonb(v_clamped_starting_idx));
  v_new_state := jsonb_set(v_new_state, '{votes}', '{}'::jsonb);
  v_new_state := jsonb_set(
    v_new_state,
    '{usedWords}',
    coalesce(p_used_words, '[]'::jsonb) || jsonb_build_array(lower(v_secret_word))
  );

  update public.rooms set state = v_new_state where code = p_room_code;
  return v_new_state;
end;
$$;

-- authenticated only — never anon. An anonymous caller would immediately
-- fail the auth.uid() check anyway, but restricting the grant makes the
-- intent explicit rather than relying on that check alone.
grant execute on function public.start_round_premium(text, text, int, text, int, jsonb) to authenticated;
