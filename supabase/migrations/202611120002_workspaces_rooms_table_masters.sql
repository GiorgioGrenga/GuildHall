alter table public.workspaces drop constraint if exists workspaces_owner_id_key;
alter table public.profiles add column if not exists avatar_url text;
alter table public.game_tables add column if not exists room_id uuid;
alter table public.game_tables add column if not exists master_user_id uuid references public.profiles (id) on delete set null;

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 70),
  description text not null default '' check (char_length(description) <= 180),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

insert into public.game_rooms (workspace_id, name, description, created_by)
select id, 'Sala principale', 'Sala condivisa dello spazio', owner_id
from public.workspaces;

update public.game_tables t
set room_id = r.id
from public.game_rooms r
where t.workspace_id = r.workspace_id;

alter table public.game_tables alter column room_id set not null;
create unique index game_rooms_id_workspace_id_idx on public.game_rooms (id, workspace_id);
alter table public.game_tables
  add constraint game_tables_room_workspace_fkey
  foreign key (room_id, workspace_id)
  references public.game_rooms (id, workspace_id)
  on delete cascade;

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
  insert into public.workspaces (name, owner_id)
    values (trim(p_name), auth.uid())
    returning id into created_workspace;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (created_workspace, auth.uid(), 'master');
  insert into public.game_rooms (workspace_id, name, description, created_by)
    values (created_workspace, 'Sala principale', 'Sala condivisa dello spazio', auth.uid());
  return created_workspace;
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

drop function if exists public.create_group_with_invite(text, text);
create function public.create_group_with_invite(p_workspace_id uuid, p_name text, p_description text default '')
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  created_group uuid;
  invite_code text;
begin
  if auth.uid() is null then raise exception 'Autenticazione richiesta.'; end if;
  if char_length(trim(p_name)) not between 1 and 70 then raise exception 'Il nome del gruppo deve contenere da 1 a 70 caratteri.'; end if;
  if char_length(coalesce(p_description, '')) > 180 then raise exception 'La descrizione è troppo lunga.'; end if;
  if not public.is_workspace_master(p_workspace_id) then raise exception 'Solo il proprietario dello spazio può creare gruppi.'; end if;
  insert into public.game_groups (workspace_id, name, description, created_by)
    values (p_workspace_id, trim(p_name), trim(coalesce(p_description, '')), auth.uid())
    returning id into created_group;
  invite_code := upper(encode(extensions.gen_random_bytes(18), 'hex'));
  insert into public.group_invites (group_id, code_hash, expires_at, created_by)
    values (created_group, encode(extensions.digest(invite_code, 'sha256'), 'hex'), now() + interval '30 days', auth.uid());
  return jsonb_build_object('group_id', created_group, 'invite_code', invite_code);
end;
$$;

create or replace function public.can_manage_table(target_table uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.game_tables t
    where t.id = target_table
      and (
        public.is_workspace_master(t.workspace_id)
        or t.master_user_id = auth.uid()
      )
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
      and not public.can_manage_table(game_table.id)
      and booking.user_id <> auth.uid()
    then null
    else booking.user_id
  end as user_id,
  booking.seat_number,
  booking.anonymous
from public.seat_bookings booking
join public.game_tables game_table on game_table.id = booking.game_table_id
where public.is_workspace_member(game_table.workspace_id);

create or replace function public.validate_table_master()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.master_user_id is not null and not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = new.workspace_id
      and wm.user_id = new.master_user_id
  ) then
    raise exception 'Il Master del tavolo deve appartenere allo stesso spazio.';
  end if;
  if tg_op = 'UPDATE' and not public.is_workspace_master(old.workspace_id)
     and (new.workspace_id is distinct from old.workspace_id
       or new.master_user_id is distinct from old.master_user_id) then
    raise exception 'Solo il proprietario dello spazio può cambiare il Master assegnato.';
  end if;
  return new;
end;
$$;

create trigger validate_game_table_master
  before insert or update on public.game_tables
  for each row execute function public.validate_table_master();

alter table public.game_rooms enable row level security;

create policy "Workspace members can read rooms"
  on public.game_rooms for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "Workspace owners manage rooms"
  on public.game_rooms for all to authenticated
  using (public.is_workspace_master(workspace_id))
  with check (public.is_workspace_master(workspace_id) and created_by = auth.uid());

drop policy if exists "Masters manage tables" on public.game_tables;
drop policy if exists "Masters update tables" on public.game_tables;
drop policy if exists "Masters delete tables" on public.game_tables;
create policy "Workspace owners create tables"
  on public.game_tables for insert to authenticated
  with check (public.is_workspace_master(workspace_id) and created_by = auth.uid());
create policy "Owners and assigned masters update tables"
  on public.game_tables for update to authenticated
  using (public.can_manage_table(id))
  with check (public.can_manage_table(id));
create policy "Owners and assigned masters delete tables"
  on public.game_tables for delete to authenticated
  using (public.can_manage_table(id));

drop policy if exists "Players can release their own seat" on public.seat_bookings;
create policy "Players and table masters can release seats"
  on public.seat_bookings for delete to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_table(game_table_id)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guildhall-media', 'guildhall-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = true, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

create policy "Guildhall images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'guildhall-media');
create policy "Users upload images to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'guildhall-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users update images in their own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'guildhall-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'guildhall-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users delete images in their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'guildhall-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.join_group_with_invite(text) to authenticated;
revoke all on function public.create_group_with_invite(uuid, text, text) from public, anon;
grant execute on function public.create_group_with_invite(uuid, text, text) to authenticated;
revoke all on function public.can_manage_table(uuid) from public, anon;
grant execute on function public.can_manage_table(uuid) to authenticated;
revoke all on function public.validate_table_master() from public, anon;
grant select, insert, update, delete on public.game_rooms to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_rooms'
  ) then
    alter publication supabase_realtime add table public.game_rooms;
  end if;
end;
$$;
