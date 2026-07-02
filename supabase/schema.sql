-- ════════════════════════════════════════════════════════════════════════
--  DALI TODO — schéma databáze (Supabase / Postgres)
--  Spuštění: Supabase → SQL Editor → vlož celý soubor → Run.
--  Vytvoří tabulky boards / zones / tasks, jednu nástěnku `main` a výchozí zóny.
--  Je idempotentní — můžeš pustit víckrát, nic nerozbije.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- kvůli gen_random_uuid()

-- ── BOARDS ─────────────────────────────────────────────────────────────
-- Nástěnka. Aplikace používá vždy řádek s key = 'main'.
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  title       text not null,
  created_at  timestamptz not null default now()
);

-- ── ZONES ──────────────────────────────────────────────────────────────
-- Barevné oblasti na plátně (HOŘÍ, TENTO TÝDEN, …). Mají vlastní pozici a rozměr.
create table if not exists public.zones (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards(id) on delete cascade,
  label       text not null,
  kind        text not null default 'free',
  accent      text not null default 'yellow',   -- red|yellow|sky|green|violet|slate
  x           double precision not null default 0,
  y           double precision not null default 0,
  w           double precision not null default 320,
  h           double precision not null default 320,
  position    double precision not null default 0,
  rule        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists zones_board_id_idx on public.zones(board_id);

-- ── TASKS ──────────────────────────────────────────────────────────────
-- Lísteček (post-it). canvas_x/y jsou world-souřadnice na plátně.
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards(id) on delete cascade,
  zone_id     uuid references public.zones(id) on delete set null,
  title       text not null default '',
  body        text not null default '',
  status      text not null default 'todo',     -- todo|doing|queued_for_agent|agent_working|done
  priority    text not null default 'normal',
  color       text not null default 'yellow',   -- yellow|green|pink|sky
  canvas_x    double precision not null default 0,
  canvas_y    double precision not null default 0,
  w           double precision not null default 200,
  h           double precision not null default 96,
  z           integer not null default 0,
  tags        text[] not null default '{}',
  assignee    text not null default 'me',
  source      text not null default 'web',
  result_note text not null default '',
  notes_md    text,                              -- volný Markdown kontext (NULL = bez poznámky)
  home        jsonb,                             -- {x,y} = původní místo (pro vrácení z HOTOVO)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_board_id_idx on public.tasks(board_id);
create index if not exists tasks_zone_id_idx  on public.tasks(zone_id);

-- ── updated_at trigger ─────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ── RLS (Row Level Security) ───────────────────────────────────────────
-- Zapínáme jako obranu navíc. Aplikace přistupuje SERVICE ROLE klíčem (server-only),
-- který RLS obchází. Bezpečnost stojí na hesle + šifrované session, ne na RLS,
-- proto zde ZÁMĚRNĚ NEjsou policy pro anon (anon roli se k datům nedostane).
alter table public.boards enable row level security;
alter table public.zones  enable row level security;
alter table public.tasks  enable row level security;

-- ── SEED: nástěnka `main` + výchozí zóny ───────────────────────────────
insert into public.boards (key, title)
values ('main', 'DALI TODO')
on conflict (key) do nothing;

insert into public.zones (board_id, label, kind, accent, x, y, w, h, position, rule)
select b.id, z.label, z.kind, z.accent, z.x, z.y, z.w, z.h, z.position, z.rule
from public.boards b
cross join (values
  ('HOŘÍ',        'free',  'red',     40,    40, 440, 1200,  0, '{"priority":"hori"}'::jsonb),
  ('TENTO TÝDEN', 'free',  'yellow', 540,    40, 440, 1200,  1, '{}'::jsonb),
  ('PROJEKTY',    'free',  'sky',   1040,    40, 440, 1200,  2, '{}'::jsonb),
  ('NÁPADY',      'free',  'green',   40,  1320, 440,  900,  3, '{}'::jsonb),
  ('PRO CLAUDE',  'free',  'violet', 540,  1320, 440,  900,  4, '{"status":"queued_for_agent","assignee":"claude"}'::jsonb),
  ('BACKLOG',     'frame', 'yellow',1040,  1320, 440,  900,  5, '{}'::jsonb),
  ('RODINA',      'free',  'green',   40,  2300, 440,  900,  6, '{}'::jsonb),
  ('HOTOVO ✓',    'frame', 'slate', 1540,    40,1300, 2600, 10, '{"status":"done"}'::jsonb)
) as z(label, kind, accent, x, y, w, h, position, rule)
where b.key = 'main'
  and not exists (select 1 from public.zones zz where zz.board_id = b.id);

-- Hotovo. Teď nastav SUPABASE_URL + SUPABASE_KEY (service_role) do .env.local.
