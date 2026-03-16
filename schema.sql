create table participants (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null,
  full_name     text not null,
  cpf           text not null unique,
  whatsapp      text not null,
  email         text,
  amount_spent  numeric(10, 2),
  code_count    integer not null default 0,
  store_origin  text,
  lgpd_consent  boolean not null default false,
  created_at    timestamptz not null default now()
);

create table codes (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  code           text not null unique,
  created_at     timestamptz not null default now()
);

create index on codes (participant_id);
create index on participants (cpf);
create index on participants (code_count desc);

alter table participants enable row level security;
alter table codes enable row level security;

create policy "public can read ranking fields"
  on participants for select
  using (true);

create policy "no public insert to participants"
  on participants for insert
  with check (false);

create policy "no public read on codes"
  on codes for select
  using (false);

create policy "no public insert to codes"
  on codes for insert
  with check (false);
