alter table public.game_rooms add column if not exists event_date date;

update public.game_rooms
set event_date = current_date
where event_date is null;

alter table public.game_rooms
  alter column event_date set default current_date,
  alter column event_date set not null;

create index if not exists game_rooms_workspace_event_date_idx
  on public.game_rooms (workspace_id, event_date);
