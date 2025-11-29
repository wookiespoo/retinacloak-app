create table if not exists retna_events (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  buyer text,
  created_at timestamptz default now()
);

create table if not exists retna_metrics (
  id uuid default gen_random_uuid() primary key,
  key text not null,
  value numeric not null,
  created_at timestamptz default now()
);

create table if not exists retna_limits (
  id uuid default gen_random_uuid() primary key,
  wallet text not null,
  purchases integer default 0,
  last_purchase_at timestamptz,
  created_at timestamptz default now()
);
