create table if not exists profiles (
  user_id text primary key,
  display_name text not null,
  role text not null default 'player' check (role in ('player', 'owner', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists courts (
  id text primary key,
  owner_id text not null references profiles (user_id),
  name text not null,
  sport text not null,
  city text not null,
  neighborhood text not null,
  address text not null default '',
  description text not null default '',
  price_cents integer not null,
  surface text not null,
  indoor boolean not null default false,
  status text not null check (status in ('pending', 'active', 'paused', 'rejected')),
  open_from text not null,
  open_until text not null,
  weekdays text not null,
  created_at timestamptz not null default now()
);

create index if not exists courts_owner_idx on courts (owner_id);
create index if not exists courts_status_idx on courts (status);

create table if not exists bookings (
  id text primary key,
  court_id text not null references courts (id),
  host_id text not null references profiles (user_id),
  play_date date not null,
  start_time text not null,
  end_time text not null,
  kind text not null check (kind in ('private', 'open')),
  spots integer not null,
  price_cents integer not null,
  host_cents integer not null,
  share_cents integer not null,
  note text not null default '',
  status text not null check (status in ('awaiting_payment', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists bookings_court_day_idx on bookings (court_id, play_date);
create index if not exists bookings_host_idx on bookings (host_id);

create unique index if not exists bookings_live_slot_uq
  on bookings (court_id, play_date, start_time)
  where status in ('awaiting_payment', 'confirmed');

create table if not exists participants (
  booking_id text not null references bookings (id),
  user_id text not null references profiles (user_id),
  status text not null check (status in ('joined', 'left')),
  created_at timestamptz not null default now(),
  primary key (booking_id, user_id)
);

create index if not exists participants_user_idx on participants (user_id);

create table if not exists payments (
  id text primary key,
  booking_id text not null references bookings (id),
  user_id text not null references profiles (user_id),
  amount_cents integer not null,
  method text not null check (method in ('pix', 'card')),
  status text not null check (status in ('draft', 'pending', 'paid', 'validated', 'rejected', 'refunded')),
  reference text not null,
  last4 text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists payments_booking_idx on payments (booking_id);
create index if not exists payments_user_idx on payments (user_id);
create index if not exists payments_status_idx on payments (status);

create table if not exists platform_settings (
  id integer primary key check (id = 1),
  fee_bps integer not null default 800 check (fee_bps >= 0 and fee_bps <= 3000),
  min_price_cents integer not null default 3000,
  max_price_cents integer not null default 80000,
  pix_validation boolean not null default true
);

insert into platform_settings (id) values (1) on conflict (id) do nothing;
