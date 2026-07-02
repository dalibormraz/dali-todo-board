# CLAUDE.md

Tento projekt je **DALI TODO** — osobní vizuální nástěnka úkolů (Next.js + Supabase + React Flow).

👉 **Hlavní průvodce pro agenta je [`AGENTS.md`](AGENTS.md)** — přečti si ho jako první.
Najdeš tam, jak vidět stav nástěnky (co je hotové / rozpracované / čeká), konvence
(zóny, barvy, stavy), vzor „agent inbox" (zóna **PRO CLAUDE**) a jak úkoly číst/přidávat/dokončovat
přes Supabase.

Rychlá fakta:
- Data = **Supabase** projekt napojený na tento repo (URL/klíč v `.env.local`, viz `.env.example`),
  nástěnka `boards.key='main'`, tabulky `zones`/`tasks`.
- Hotové úkoly žijí v zóně **HOTOVO ✓** (status `done`).
- Realtime zatím není → po zápisu do DB reload prohlížeče (nebo se projeví do ~2,5 s pollingem).
- **Setup:** [`docs/SETUP.md`](docs/SETUP.md) · **Použití:** [`docs/GUIDE.md`](docs/GUIDE.md) ·
  **Schéma DB:** [`supabase/schema.sql`](supabase/schema.sql).
- **Bezpečnost:** `SUPABASE_KEY` (service_role) a `SESSION_PASSWORD` jen na serveru, nikdy do klienta.
