-- Drop old structures (we have no real data yet)
drop function if exists place_trade cascade;
drop table if exists trades cascade;
drop table if exists positions cascade;

-- Update markets table
alter table markets drop column if exists q_yes;
alter table markets drop column if exists q_no;
alter table markets add column if not exists market_type text not null default 'binary' 
  check (market_type in ('binary', 'categorical', 'multi'));
alter table markets add column if not exists fees_collected numeric not null default 0;
alter table markets drop column if exists resolution;
-- Resolution will now be tracked per-outcome for multi-type

-- Create outcomes table
create table outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  q_yes numeric not null default 0,
  q_no numeric not null default 0,
  resolution text check (resolution in ('yes', 'no', 'invalid')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index outcomes_market_id_idx on outcomes(market_id);

-- Recreate trades with outcome_id and fee tracking
create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  market_id uuid not null references markets(id) on delete cascade,
  outcome_id uuid not null references outcomes(id) on delete cascade,
  side text not null check (side in ('yes', 'no')),
  shares numeric not null,
  gross_cost numeric not null,
  fee numeric not null,
  total_cost numeric not null,
  price_after numeric not null,
  created_at timestamptz not null default now()
);
create index trades_user_id_idx on trades(user_id);
create index trades_market_id_idx on trades(market_id);
create index trades_outcome_id_idx on trades(outcome_id);

-- Recreate positions keyed on outcome
create table positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  outcome_id uuid not null references outcomes(id) on delete cascade,
  yes_shares numeric not null default 0,
  no_shares numeric not null default 0,
  unique(user_id, outcome_id)
);
create index positions_user_id_idx on positions(user_id);

-- RLS
alter table outcomes enable row level security;
alter table trades enable row level security;
alter table positions enable row level security;

create policy "Outcomes are viewable by everyone" on outcomes for select using (true);
create policy "Only admins can insert outcomes" on outcomes for insert
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));
create policy "Only admins can update outcomes" on outcomes for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

create policy "Trades are viewable by everyone" on trades for select using (true);
create policy "Positions are viewable by everyone" on positions for select using (true);
