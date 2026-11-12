create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  color text not null default '#a28dde',
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 70),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('master', 'player')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.game_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 70),
  description text not null default '' check (char_length(description) <= 180),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.game_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.game_groups (id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 50 check (max_uses between 1 and 500),
  use_count integer not null default 0 check (use_count >= 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.session_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.game_groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 70),
  status text not null default 'active' check (status in ('active', 'confirmed', 'closed')),
  confirmed_date date,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check ((status = 'confirmed') = (confirmed_date is not null))
);

create unique index session_polls_one_active_per_group
  on public.session_polls (group_id) where status = 'active';

create table public.poll_dates (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.session_polls (id) on delete cascade,
  date date not null,
  unique (poll_id, date)
);

create table public.poll_votes (
  poll_date_id uuid not null references public.poll_dates (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  available boolean not null,
  updated_at timestamptz not null default now(),
  primary key (poll_date_id, user_id)
);

create table public.game_tables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 70),
  adventure_title text not null check (char_length(adventure_title) between 1 and 70),
  system text not null check (char_length(system) between 1 and 60),
  image_url text check (image_url is null or char_length(image_url) <= 2048),
  max_seats integer not null check (max_seats between 2 and 8),
  notes text not null default '' check (char_length(notes) <= 500),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seat_bookings (
  id uuid primary key default gen_random_uuid(),
  game_table_id uuid not null references public.game_tables (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  seat_number integer not null check (seat_number between 1 and 8),
  anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_table_id, seat_number),
  unique (game_table_id, user_id)
);

create or replace function public.prevent_removing_booked_seats()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.seat_bookings
    where game_table_id = new.id and seat_number > new.max_seats
  ) then
    raise exception 'Libera prima i posti prenotati oltre il nuovo limite.';
  end if;
  return new;
end;
$$;

create trigger keep_booked_seats_in_range
  before update of max_seats on public.game_tables
  for each row execute function public.prevent_removing_booked_seats();

create or replace function public.touch_table_after_seat_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.game_tables set updated_at = now() where id = old.game_table_id;
    return old;
  end if;
  update public.game_tables set updated_at = now() where id = new.game_table_id;
  return new;
end;
$$;

create trigger seat_booking_updates_table
  after insert or delete on public.seat_bookings
  for each row execute function public.touch_table_after_seat_change();

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_master(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace and wm.user_id = auth.uid() and wm.role = 'master'
  );
$$;

create or replace function public.is_group_member(target_group uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group and gm.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_group(target_group uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.game_groups g
    join public.workspace_members wm on wm.workspace_id = g.workspace_id
    where g.id = target_group and wm.user_id = auth.uid() and wm.role = 'master'
  );
$$;

create or replace function public.profile_shares_workspace(target_profile uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = target_profile
  );
$$;

create or replace view public.visible_seat_bookings
with (security_barrier = true)
as
select
  booking.id,
  booking.game_table_id,
  case
    when booking.anonymous
      and not public.is_workspace_master(game_table.workspace_id)
      and booking.user_id <> auth.uid()
    then null
    else booking.user_id
  end as user_id,
  booking.seat_number,
  booking.anonymous
from public.seat_bookings booking
join public.game_tables game_table on game_table.id = booking.game_table_id
where public.is_workspace_member(game_table.workspace_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  requested_name text;
  palette text[] := array['#d79865', '#a28dde', '#77b4a1', '#dc8f90', '#83a4df', '#c4a768', '#da8bc5'];
  color_index integer;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  color_index := (abs(hashtext(new.id::text)::bigint) % array_length(palette, 1))::integer + 1;
  insert into public.profiles (id, display_name, color)
  values (
    new.id,
    left(coalesce(requested_name, split_part(new.email, '@', 1), 'Avventuriero'), 40),
    palette[color_index]
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  created_workspace uuid;
begin
  if auth.uid() is null then raise exception 'Autenticazione richiesta.'; end if;
  if char_length(trim(p_name)) not between 1 and 70 then raise exception 'Il nome dello spazio deve contenere da 1 a 70 caratteri.'; end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid()) then
    raise exception 'Questo account appartiene già a uno spazio di gioco.';
  end if;
  insert into public.workspaces (name, owner_id) values (trim(p_name), auth.uid()) returning id into created_workspace;
  insert into public.workspace_members (workspace_id, user_id, role) values (created_workspace, auth.uid(), 'master');
  return created_workspace;
end;
$$;

create or replace function public.create_group_invite(p_group_id uuid)
returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  invite_code text;
begin
  if not public.can_manage_group(p_group_id) then raise exception 'Solo il Master dello spazio può creare inviti.'; end if;
  invite_code := upper(encode(extensions.gen_random_bytes(18), 'hex'));
  insert into public.group_invites (group_id, code_hash, expires_at, created_by)
  values (p_group_id, encode(extensions.digest(invite_code, 'sha256'), 'hex'), now() + interval '30 days', auth.uid());
  return invite_code;
end;
$$;

create or replace function public.create_group_with_invite(p_name text, p_description text default '')
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  workspace_to_use uuid;
  created_group uuid;
  invite_code text;
begin
  if auth.uid() is null then raise exception 'Autenticazione richiesta.'; end if;
  if char_length(trim(p_name)) not between 1 and 70 then raise exception 'Il nome del gruppo deve contenere da 1 a 70 caratteri.'; end if;
  if char_length(coalesce(p_description, '')) > 180 then raise exception 'La descrizione è troppo lunga.'; end if;
  select workspace_id into workspace_to_use from public.workspace_members
    where user_id = auth.uid() and role = 'master';
  if workspace_to_use is null then raise exception 'Solo il Master può creare gruppi.'; end if;
  insert into public.game_groups (workspace_id, name, description, created_by)
    values (workspace_to_use, trim(p_name), trim(coalesce(p_description, '')), auth.uid())
    returning id into created_group;
  invite_code := upper(encode(extensions.gen_random_bytes(18), 'hex'));
  insert into public.group_invites (group_id, code_hash, expires_at, created_by)
    values (created_group, encode(extensions.digest(invite_code, 'sha256'), 'hex'), now() + interval '30 days', auth.uid());
  return jsonb_build_object('group_id', created_group, 'invite_code', invite_code);
end;
$$;

create or replace function public.join_group_with_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  invite record;
begin
  if auth.uid() is null then raise exception 'Autenticazione richiesta.'; end if;
  if char_length(trim(p_code)) not between 20 and 80 then raise exception 'Il codice invito non è valido.'; end if;
  select gi.*, g.workspace_id
    into invite
    from public.group_invites gi
    join public.game_groups g on g.id = gi.group_id
    where gi.code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
    for update of gi;
  if not found or invite.expires_at <= now() or invite.use_count >= invite.max_uses then
    raise exception 'Il codice invito è scaduto o non è valido.';
  end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid() and workspace_id <> invite.workspace_id) then
    raise exception 'Il tuo account appartiene già a un altro spazio di gioco.';
  end if;
  if exists (select 1 from public.group_members where group_id = invite.group_id and user_id = auth.uid()) then
    raise exception 'Fai già parte di questo gruppo.';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (invite.workspace_id, auth.uid(), 'player')
    on conflict (workspace_id, user_id) do nothing;
  insert into public.group_members (group_id, user_id)
    values (invite.group_id, auth.uid());
  update public.group_invites set use_count = use_count + 1 where id = invite.id;
  return invite.group_id;
end;
$$;

create or replace function public.create_session_poll(p_group_id uuid, p_title text, p_dates date[])
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  created_poll uuid;
begin
  if not public.can_manage_group(p_group_id) then raise exception 'Solo il Master del gruppo può aprire un sondaggio.'; end if;
  if char_length(trim(p_title)) not between 1 and 70 then raise exception 'Il titolo deve contenere da 1 a 70 caratteri.'; end if;
  if coalesce(cardinality(p_dates), 0) not between 1 and 62 then raise exception 'Seleziona da 1 a 62 date.'; end if;
  update public.session_polls set status = 'closed' where group_id = p_group_id and status = 'active';
  insert into public.session_polls (group_id, title) values (p_group_id, trim(p_title)) returning id into created_poll;
  insert into public.poll_dates (poll_id, date)
    select created_poll, selected_date from (select distinct unnest(p_dates) as selected_date) dates;
  return created_poll;
end;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.game_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.session_polls enable row level security;
alter table public.poll_dates enable row level security;
alter table public.poll_votes enable row level security;
alter table public.game_tables enable row level security;
alter table public.seat_bookings enable row level security;

create policy "Profiles are visible to members of the same workspace"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.profile_shares_workspace(id));
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Workspace members can read their workspace"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
create policy "Members can read workspace membership"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Masters see all groups and players see joined groups"
  on public.game_groups for select to authenticated
  using (public.is_workspace_master(workspace_id) or public.is_group_member(id));
create policy "Masters create groups in their workspace"
  on public.game_groups for insert to authenticated
  with check (public.is_workspace_master(workspace_id) and created_by = auth.uid());
create policy "Masters update their workspace groups"
  on public.game_groups for update to authenticated
  using (public.is_workspace_master(workspace_id))
  with check (public.is_workspace_master(workspace_id));
create policy "Masters delete their workspace groups"
  on public.game_groups for delete to authenticated
  using (public.is_workspace_master(workspace_id));

create policy "Group members and workspace masters can read group membership"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id) or exists (
    select 1 from public.game_groups g where g.id = group_id and public.is_workspace_master(g.workspace_id)
  ));

create policy "Group members can read polls"
  on public.session_polls for select to authenticated
  using (public.is_group_member(group_id) or public.can_manage_group(group_id));
create policy "Masters create polls"
  on public.session_polls for insert to authenticated
  with check (public.can_manage_group(group_id) and created_by = auth.uid());
create policy "Masters update polls"
  on public.session_polls for update to authenticated
  using (public.can_manage_group(group_id))
  with check (public.can_manage_group(group_id));
create policy "Masters delete polls"
  on public.session_polls for delete to authenticated
  using (public.can_manage_group(group_id));

create policy "Group members can read poll dates"
  on public.poll_dates for select to authenticated
  using (exists (select 1 from public.session_polls p where p.id = poll_id and (public.is_group_member(p.group_id) or public.can_manage_group(p.group_id))));
create policy "Masters create poll dates"
  on public.poll_dates for insert to authenticated
  with check (exists (select 1 from public.session_polls p where p.id = poll_id and public.can_manage_group(p.group_id)));

create policy "Group members can read votes"
  on public.poll_votes for select to authenticated
  using (exists (
    select 1 from public.poll_dates d
    join public.session_polls p on p.id = d.poll_id
    where d.id = poll_date_id and (public.is_group_member(p.group_id) or public.can_manage_group(p.group_id))
  ));
create policy "Members can create their own votes in active polls"
  on public.poll_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.poll_dates d
      join public.session_polls p on p.id = d.poll_id
      where d.id = poll_date_id and p.status = 'active'
        and (public.is_group_member(p.group_id) or public.can_manage_group(p.group_id))
    )
  );
create policy "Members can update their own votes in active polls"
  on public.poll_votes for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.poll_dates d
      join public.session_polls p on p.id = d.poll_id
      where d.id = poll_date_id and p.status = 'active'
        and (public.is_group_member(p.group_id) or public.can_manage_group(p.group_id))
    )
  );
create policy "Members can delete their own votes"
  on public.poll_votes for delete to authenticated
  using (user_id = auth.uid());

create policy "Workspace members can read tables"
  on public.game_tables for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "Masters manage tables"
  on public.game_tables for insert to authenticated
  with check (public.is_workspace_master(workspace_id) and created_by = auth.uid());
create policy "Masters update tables"
  on public.game_tables for update to authenticated
  using (public.is_workspace_master(workspace_id))
  with check (public.is_workspace_master(workspace_id));
create policy "Masters delete tables"
  on public.game_tables for delete to authenticated
  using (public.is_workspace_master(workspace_id));

create policy "Workspace members can read seat bookings"
  on public.seat_bookings for select to authenticated
  using (exists (select 1 from public.game_tables t where t.id = game_table_id and public.is_workspace_member(t.workspace_id)));
create policy "Players can book a seat for themselves"
  on public.seat_bookings for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.game_tables t
      where t.id = game_table_id
        and public.is_workspace_member(t.workspace_id)
        and seat_number <= t.max_seats
    )
  );
create policy "Players can release their own seat"
  on public.seat_bookings for delete to authenticated
  using (user_id = auth.uid());

revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.create_group_invite(uuid) from public, anon;
revoke all on function public.create_group_with_invite(text, text) from public, anon;
revoke all on function public.join_group_with_invite(text) from public, anon;
revoke all on function public.create_session_poll(uuid, text, date[]) from public, anon;
revoke all on function public.touch_table_after_seat_change() from public, anon;
revoke all on function public.prevent_removing_booked_seats() from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.create_group_invite(uuid) to authenticated;
grant execute on function public.create_group_with_invite(text, text) to authenticated;
grant execute on function public.join_group_with_invite(text) to authenticated;
grant execute on function public.create_session_poll(uuid, text, date[]) to authenticated;
grant execute on function public.touch_table_after_seat_change() to authenticated;
grant execute on function public.prevent_removing_booked_seats() to authenticated;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_master(uuid) from public, anon;
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.can_manage_group(uuid) from public, anon;
revoke all on function public.profile_shares_workspace(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_master(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.can_manage_group(uuid) to authenticated;
grant execute on function public.profile_shares_workspace(uuid) to authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.workspaces, public.workspace_members, public.group_members to authenticated;
grant select, insert, update, delete on public.game_groups to authenticated;
grant select, insert, update, delete on public.session_polls to authenticated;
grant select, insert on public.poll_dates to authenticated;
grant select, insert, update, delete on public.poll_votes to authenticated;
grant select, insert, update, delete on public.game_tables to authenticated;
grant insert, delete on public.seat_bookings to authenticated;
revoke all on public.visible_seat_bookings from public, anon;
grant select on public.visible_seat_bookings to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['game_groups', 'group_members', 'session_polls', 'poll_dates', 'poll_votes', 'game_tables', 'seat_bookings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
