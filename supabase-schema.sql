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
