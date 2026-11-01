-- Personal app: only the Worker has service credentials. There is no public Data API access.
create table public.tima_events (
 id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('lesson','shift','event')),
 title text not null check (length(title) between 1 and 200), starts_at timestamptz not null, ends_at timestamptz not null,
 room text not null default '', teacher text not null default '', lesson_type text not null default '', notes text not null default '',
 source_key text unique, created_at timestamptz not null default now(),
 check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);
create index tima_events_starts on public.tima_events (starts_at);
create table public.tima_tasks (
 id uuid primary key default gen_random_uuid(), title text not null check (length(title) between 1 and 200),
 due_at timestamptz, done boolean not null default false, priority text not null default 'normal' check (priority in ('normal','high')),
 created_at timestamptz not null default now()
);
create index tima_tasks_due on public.tima_tasks (due_at) where done = false;
create table public.tima_money (
 id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('income','expense','bill')),
 title text not null check (length(title) between 1 and 200), amount numeric(15,2) not null check(amount > 0),
 category text not null default '', date date not null, paid boolean not null default false,
 created_at timestamptz not null default now()
);
create index tima_money_date on public.tima_money (date);
create table public.tima_settings (id integer primary key check(id=1), value jsonb not null default '{}');
insert into public.tima_settings (id) values (1);
create table public.tima_deliveries (
 key text primary key, payload text not null, lease uuid not null default gen_random_uuid(), lease_until timestamptz not null default now(),
 expires_at timestamptz not null, sent_at timestamptz, attempts integer not null default 0,
 created_at timestamptz not null default now()
);
create index tima_pending_deliveries on public.tima_deliveries (lease_until) where sent_at is null;
alter table public.tima_events enable row level security;
alter table public.tima_tasks enable row level security;
alter table public.tima_money enable row level security;
alter table public.tima_settings enable row level security;
alter table public.tima_deliveries enable row level security;
revoke all on public.tima_events, public.tima_tasks, public.tima_money, public.tima_settings, public.tima_deliveries from anon, authenticated;
grant all on public.tima_events, public.tima_tasks, public.tima_money, public.tima_settings, public.tima_deliveries to service_role;
create function public.tima_claim(p_key text, p_payload text, p_expires timestamptz) returns uuid
language sql security invoker set search_path = '' as $$
 insert into public.tima_deliveries as d (key,payload,lease_until,expires_at,attempts)
 values(p_key,p_payload,now()+interval '60 seconds',p_expires,1)
 on conflict(key) do update set lease=gen_random_uuid(), lease_until=now()+interval '60 seconds', attempts=d.attempts+1
 where d.sent_at is null and d.lease_until <= now() and d.expires_at > now() and d.attempts < 4
 returning lease;
$$;
revoke all on function public.tima_claim(text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.tima_claim(text,text,timestamptz) to service_role;
