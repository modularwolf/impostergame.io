-- Adds leave_room_secure / kick_room_player_secure.
--
-- Why these exist: the original leave_room and kick_room_player (see
-- 000_baseline_schema.sql) detect "did the imposter just leave/get kicked"
-- by reading players[].isImposter out of the broadcast rooms.state. That
-- flag is only ever set by the OLD start_round. Once the web client switches
-- to start_round_secure (001_private_round_secrets.sql), isImposter is never
-- written into the public state until reveal_round_secure runs — so the
-- "imposter left mid-round -> round ends immediately" feature would silently
-- stop working the moment the round-start path is swapped, with no error,
-- just a feature that quietly no-ops.
--
-- These two functions are otherwise byte-for-byte identical to the
-- originals, except the imposter check now reads
-- round_secrets.imposter_player_id instead of the players array, and (kick
-- only) they run as the room's actual imposter-detector regardless of
-- whether a secure round is even active — if there's no round_secrets row
-- (e.g. still in lobby), the check simply finds no match and behaves like a
-- normal leave/kick, same as before.
--
-- Fully additive. Does not modify leave_room or kick_room_player, so any
-- caller still on the old path (e.g. the current web client, until its
-- App.tsx diff lands) is unaffected.
--
-- Safe to run multiple times.

create or replace function public.leave_room_secure(p_room_code text, p_player_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text := upper(trim(p_room_code));
  v_state jsonb;
  v_players jsonb;
  v_votes jsonb := '{}'::jsonb;
  v_pair record;
  v_was_host boolean;
  v_leaving_name text;
  v_leaver_was_imposter boolean;
  v_stage text;
  v_new_host_id text;
  v_new_host_name text;
  v_len int;
  v_turn int;
begin
  select state into v_state
  from public.rooms
  where code = v_code
  for update;

  if v_state is null then
    return null;
  end if;

  select p->>'name' into v_leaving_name
  from jsonb_array_elements(coalesce(v_state->'players', '[]'::jsonb)) p
  where p->>'id' = p_player_id
  limit 1;

  if v_leaving_name is null then
    return v_state;
  end if;

  -- Only difference from leave_room: check the private secret, not the
  -- (under the secure path, unpopulated-until-reveal) public isImposter flag.
  select (imposter_player_id = p_player_id) into v_leaver_was_imposter
  from public.round_secrets
  where room_code = v_code;
  v_leaver_was_imposter := coalesce(v_leaver_was_imposter, false);

  v_stage := coalesce(v_state->>'stage', 'lobby');
  v_was_host := coalesce(v_state->>'hostPlayerId', '') = p_player_id;

  select coalesce(jsonb_agg(p), '[]'::jsonb) into v_players
  from jsonb_array_elements(coalesce(v_state->'players', '[]'::jsonb)) p
  where p->>'id' <> p_player_id;

  if jsonb_array_length(v_players) = 0 then
    delete from public.round_secrets where room_code = v_code;
    delete from public.rooms where code = v_code;
    return null;
  end if;

  for v_pair in
    select key, value
    from jsonb_each_text(coalesce(v_state->'votes', '{}'::jsonb))
  loop
    if v_pair.key <> p_player_id and v_pair.value <> p_player_id then
      v_votes := v_votes || jsonb_build_object(v_pair.key, v_pair.value);
    end if;
  end loop;

  v_state := jsonb_set(v_state, '{players}', v_players);
  v_state := jsonb_set(v_state, '{votes}', v_votes);

  if v_leaver_was_imposter and v_stage = 'game' then
    v_state := jsonb_set(v_state, '{stage}', '"reveal"'::jsonb);
    v_state := jsonb_set(v_state, '{roundEndReason}', '"imposterLeft"'::jsonb);
    v_state := jsonb_set(
      v_state, '{roomNotice}',
      to_jsonb(v_leaving_name || ' (the imposter) left. Round over.')
    );
    -- The round is over and the imposter is gone; the secret no longer
    -- needs to stay private. Clear it so it can't linger unreferenced.
    delete from public.round_secrets where room_code = v_code;
  else
    v_len := jsonb_array_length(v_players);
    v_turn := coalesce((v_state->>'turnIndex')::int, 0);
    if v_len > 0 then
      v_state := jsonb_set(v_state, '{turnIndex}', to_jsonb(v_turn % v_len));
    end if;
    v_state := jsonb_set(
      v_state, '{roomNotice}',
      to_jsonb(v_leaving_name || ' left the room.')
    );
  end if;

  if v_was_host then
    select p->>'id', p->>'name'
      into v_new_host_id, v_new_host_name
    from jsonb_array_elements(v_players) p
    limit 1;

    select coalesce(jsonb_agg(
      (p - 'isImposter') || jsonb_build_object('ready', false)
    ), '[]'::jsonb)
    into v_players
    from jsonb_array_elements(v_players) p;

    v_state := jsonb_set(v_state, '{hostPlayerId}', to_jsonb(v_new_host_id));
    v_state := jsonb_set(v_state, '{stage}', '"lobby"'::jsonb);
    v_state := jsonb_set(v_state, '{players}', v_players);
    v_state := jsonb_set(v_state, '{round}', 'null'::jsonb);
    v_state := jsonb_set(v_state, '{turnIndex}', '0'::jsonb);
    v_state := jsonb_set(v_state, '{wordHistory}', '[]'::jsonb);
    v_state := jsonb_set(v_state, '{votes}', '{}'::jsonb);
    v_state := v_state - 'roundEndReason';
    v_state := jsonb_set(
      v_state, '{roomNotice}',
      to_jsonb(v_leaving_name || ' left the room. ' || v_new_host_name || ' is now the host.')
    );
    -- Host handoff always returns to a clean lobby, so any in-flight secret
    -- round is moot either way.
    delete from public.round_secrets where room_code = v_code;
  end if;

  update public.rooms set state = v_state where code = v_code;
  return v_state;
end;
$function$;

create or replace function public.kick_room_player_secure(p_room_code text, p_host_id text, p_player_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text := upper(trim(p_room_code));
  v_state jsonb;
  v_players jsonb;
  v_votes jsonb;
  v_pair record;
  v_len int;
  v_turn int;
  v_kicked_imposter boolean;
  v_stage text;
  v_kicked_name text;
begin
  select state into v_state
  from public.rooms
  where code = v_code
  for update;

  if v_state is null then raise exception 'Room not found'; end if;
  if coalesce(v_state->>'hostPlayerId', '') <> p_host_id then raise exception 'Only the host can remove players'; end if;
  if p_player_id = p_host_id then raise exception 'The host cannot remove themselves'; end if;

  v_stage := coalesce(v_state->>'stage', 'lobby');

  select p->>'name' into v_kicked_name
  from jsonb_array_elements(coalesce(v_state->'players', '[]'::jsonb)) p
  where p->>'id' = p_player_id
  limit 1;

  -- Only difference from kick_room_player: check the private secret, not
  -- the public isImposter flag.
  select (imposter_player_id = p_player_id) into v_kicked_imposter
  from public.round_secrets
  where room_code = v_code;
  v_kicked_imposter := coalesce(v_kicked_imposter, false);

  select coalesce(jsonb_agg(p), '[]'::jsonb) into v_players
  from jsonb_array_elements(coalesce(v_state->'players', '[]'::jsonb)) p
  where p->>'id' <> p_player_id;

  v_votes := '{}'::jsonb;
  for v_pair in select key, value from jsonb_each_text(coalesce(v_state->'votes', '{}'::jsonb))
  loop
    if v_pair.key <> p_player_id and v_pair.value <> p_player_id then
      v_votes := v_votes || jsonb_build_object(v_pair.key, v_pair.value);
    end if;
  end loop;

  v_state := jsonb_set(v_state, '{players}', v_players);
  v_state := jsonb_set(v_state, '{votes}', v_votes);

  if v_kicked_imposter and v_stage = 'game' then
    v_state := jsonb_set(v_state, '{stage}', '"reveal"'::jsonb);
    v_state := jsonb_set(v_state, '{roundEndReason}', '"imposterLeft"'::jsonb);
    v_state := jsonb_set(
      v_state, '{roomNotice}',
      to_jsonb(coalesce(v_kicked_name, 'The imposter') || ' (the imposter) was removed. Round over.')
    );
    delete from public.round_secrets where room_code = v_code;
  else
    v_len := jsonb_array_length(v_players);
    v_turn := coalesce((v_state->>'turnIndex')::int, 0);
    if v_len > 0 then
      v_state := jsonb_set(v_state, '{turnIndex}', to_jsonb(v_turn % v_len));
    end if;
  end if;

  update public.rooms set state = v_state where code = v_code;
  return v_state;
end;
$function$;

grant execute on function public.leave_room_secure(text, text) to anon;
grant execute on function public.kick_room_player_secure(text, text, text) to anon;
