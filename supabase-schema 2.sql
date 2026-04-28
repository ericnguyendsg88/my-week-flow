-- Run this in Supabase → SQL Editor → New query
-- No auth. device_id is a plain text column used as a filter in queries.
-- RLS is disabled — rows are isolated by device_id in application code.

create table if not exists events (
  id             text primary key,
  device_id      text not null,
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

create table if not exists captures (
  id          text primary key,
  device_id   text not null,
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
