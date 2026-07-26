-- Ports the secret-word / imposter-role exposure fix from the ImposterGame
-- mobile app repo (supabase/migrations/001_private_round_secrets.sql there).
--
-- STATUS: this is already LIVE on the shared production database — the
-- mobile app has been calling start_round_secure / get_my_round_info /
-- reveal_round_secure for a while. Confirmed via schema export on
-- 2026-07-26. This file is included here purely so the web repo's own
-- migration history is complete and accurate; running it changes nothing on
-- the live DB (every statement is idempotent), it just documents what's
-- already there so this repo can safely build on top of it.
--
-- The bug it fixes: the web app's own `start_round` (see
-- 000_baseline_schema.sql) writes the secret word and every player's
-- isImposter flag into the public `rooms.state` blob, which Realtime
-- broadcasts to every connected client. Any player can read everyone
-- else's role by inspecting the websocket payload. The web CLIENT still
-- calls the old `start_round` as of this writing — the DB-side fix already
-- exists, the web app just isn't using it yet. That client-side switch is a
-- separate, later change (see the App.tsx diff in this same PR).
--
-- Fully additive. Does NOT modify `start_round`, `cast_room_vote`,
-- `restart_room_to_lobby`, or any other existing RPC.
--
-- Safe to run multiple times.

create table if not exists public.round_secrets (
  room_code text primary key references public.rooms(code) on delete cascade,
  imposter_player_id text not null,
  secret_word text not null,
  updated_at timestamptz not null default now()
);

alter table public.round_secrets enable row level security;

create or replace function public.start_round_secure(
  p_room_code text,
  p_host_id text,
  p_imposter_index int,
  p_secret_word text,
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
begin
  select state into v_state from public.rooms where code = p_room_code for update;
  if v_state is null then
    raise exception 'Room not found';
  end if;

  if (v_state->>'hostPlayerId') is distinct from p_host_id then
    raise exception 'Only the host can start the round';
  end if;

  v_players := v_state->'players';
  v_player_count := jsonb_array_length(v_players);
  if v_player_count < 3 then
    raise exception 'Need at least 3 players';
  end if;

  v_clamped_imposter_idx := least(greatest(p_imposter_index, 0), v_player_count - 1);
  v_clamped_starting_idx := least(greatest(p_starting_index, 0), v_player_count - 1);
  v_imposter_id := v_players -> v_clamped_imposter_idx ->> 'id';

  insert into public.round_secrets (room_code, imposter_player_id, secret_word, updated_at)
  values (p_room_code, v_imposter_id, p_secret_word, now())
  on conflict (room_code) do update
    set imposter_player_id = excluded.imposter_player_id,
        secret_word = excluded.secret_word,
        updated_at = now();

  v_new_state := jsonb_set(v_state, '{stage}', '"game"');
  v_new_state := jsonb_set(v_new_state, '{round}', jsonb_build_object('categoryId', p_category_id));
  v_new_state := jsonb_set(v_new_state, '{turnIndex}', to_jsonb(v_clamped_starting_idx));
  v_new_state := jsonb_set(v_new_state, '{votes}', '{}'::jsonb);
  v_new_state := jsonb_set(v_new_state, '{usedWords}', p_used_words);

  update public.rooms set state = v_new_state where code = p_room_code;
  return v_new_state;
end;
$$;

create or replace function public.get_my_round_info(
  p_room_code text,
  p_player_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret record;
begin
  select imposter_player_id, secret_word into v_secret
  from public.round_secrets
  where room_code = p_room_code;

  if not found then
    raise exception 'No active round for this room';
  end if;

  if v_secret.imposter_player_id = p_player_id then
    return jsonb_build_object('isImposter', true, 'secretWord', null);
  else
    return jsonb_build_object('isImposter', false, 'secretWord', v_secret.secret_word);
  end if;
end;
$$;

create or replace function public.reveal_round_secure(
  p_room_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_secret record;
  v_new_players jsonb;
  v_new_state jsonb;
begin
  select state into v_state from public.rooms where code = p_room_code for update;
  if v_state is null then
    raise exception 'Room not found';
  end if;

  select imposter_player_id, secret_word into v_secret
  from public.round_secrets
  where room_code = p_room_code;

  if not found then
    raise exception 'No active round for this room';
  end if;

  select jsonb_agg(
    case when elem->>'id' = v_secret.imposter_player_id
      then elem || jsonb_build_object('isImposter', true)
      else elem || jsonb_build_object('isImposter', false)
    end
  )
  into v_new_players
  from jsonb_array_elements(v_state->'players') as elem;

  v_new_state := jsonb_set(v_state, '{stage}', '"reveal"');
  v_new_state := jsonb_set(v_new_state, '{players}', v_new_players);
  v_new_state := jsonb_set(
    v_new_state,
    '{round}',
    coalesce(v_new_state->'round', '{}'::jsonb) || jsonb_build_object('secretWord', v_secret.secret_word)
  );

  update public.rooms set state = v_new_state where code = p_room_code;
  delete from public.round_secrets where room_code = p_room_code;

  return v_new_state;
end;
$$;

grant execute on function public.start_round_secure(text, text, int, text, text, int, jsonb) to anon;
grant execute on function public.get_my_round_info(text, text) to anon;
grant execute on function public.reveal_round_secure(text) to anon;
