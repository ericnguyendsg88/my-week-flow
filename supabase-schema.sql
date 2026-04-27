-- Run in Supabase → SQL Editor → New query
-- Drops and recreates tables using user_id from Supabase auth.

drop table if exists events;
drop table if exists captures;

create table events (
  id             text primary key,
  user_id        uuid not null,
  title          text not null,
  date           text not null,
  start          integer not null,
  duration       integer not null,
  category       text,
  tag_id         text,
  where_         text,
  who            text,
  tentative      boolean,
  completed      boolean,
  source         text default 'local',
  google_id      text,
  all_day        boolean default false,
  recurrence_id  text,
  attached_items jsonb,
  spendings      jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table captures (
  id          text primary key,
  user_id     uuid not null,
  kind        text not null,
  title       text not null,
  url         text,
  day_key     text,
  tag_id      text,
  start       integer,
  placed      boolean,
  meal_type   text,
  created_at  timestamptz default now()
);

-- Public invitation cards. Anyone with the link can read & RSVP.
create table if not exists invitations (
  id          text primary key,
  host_name   text,
  title       text not null,
  date        text not null,
  start       integer not null,
  duration    integer not null,
  where_      text,
  tag_id      text,
  note        text,
  created_at  timestamptz default now()
);

create table if not exists invitation_rsvps (
  id            uuid primary key default gen_random_uuid(),
  invitation_id text not null references invitations(id) on delete cascade,
  guest_name    text not null,
  status        text not null check (status in ('accepted','declined','maybe')),
  message       text,
  created_at    timestamptz default now()
);

alter table invitations enable row level security;
alter table invitation_rsvps enable row level security;

-- Anyone (anon + auth) can read invitations & RSVPs
drop policy if exists "public read invitations" on invitations;
create policy "public read invitations" on invitations for select using (true);
drop policy if exists "public insert invitations" on invitations;
create policy "public insert invitations" on invitations for insert with check (true);

drop policy if exists "public read rsvps" on invitation_rsvps;
create policy "public read rsvps" on invitation_rsvps for select using (true);
drop policy if exists "public insert rsvps" on invitation_rsvps;
create policy "public insert rsvps" on invitation_rsvps for insert with check (true);
