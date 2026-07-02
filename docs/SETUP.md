# 🛠️ SETUP — rozjeď si vlastní DALI TODO

Od nuly k běžící zaheslované nástěnce. Počítej ~15 minut. Potřebuješ účet na
**Supabase** (zdarma) a **Vercel** (zdarma) a nainstalovaný **Node 20+**.

---

## 1. Klon + závislosti

```bash
git clone <tvuj-fork-nebo-tento-repo> dali-todo
cd dali-todo
npm install
```

## 2. Databáze (Supabase)

1. Na [supabase.com](https://supabase.com) → **New project** (zvol region blízko sebe, např. EU).
2. Po vytvoření otevři **SQL Editor** → **New query**.
3. Otevři soubor [`supabase/schema.sql`](../supabase/schema.sql), zkopíruj **celý obsah**, vlož a dej **Run**.
   - Vytvoří tabulky `boards` / `zones` / `tasks`, nástěnku `main` a 8 výchozích zón.
   - Je idempotentní — když pustíš víckrát, nic nerozbije.
4. Jdi do **Project Settings → API** a opiš si:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** klíč (sekce *Project API keys*, „reveal") → `SUPABASE_KEY`

> ⚠️ **service_role** klíč má plný přístup. Patří **jen na server** — nikdy ho nedávej do
> proměnné s prefixem `NEXT_PUBLIC_` a nikam do klientského kódu. V téhle appce ho čte
> jen `src/lib/supabase.ts` na serveru. Bezpečnost appky stojí na hesle + session.

## 3. Proměnné prostředí

```bash
cp .env.example .env.local
```

Vyplň `.env.local`:

| Proměnná | Jak získat |
|---|---|
| `SESSION_PASSWORD` | `openssl rand -base64 32` (32+ znaků, náhodné) |
| `APP_PASSWORD_HASH` | `npm run hash -- "tvojeSilneHeslo"` → vloží se base64 hash |
| `SUPABASE_URL` | Project URL ze Supabase |
| `SUPABASE_KEY` | service_role klíč ze Supabase |

> Heslo do appky si volíš ty přes `npm run hash`. Plaintext hesla se **nikam neukládá** —
> v env je jen jeho hash.

## 4. Lokální spuštění

```bash
npm run dev      # → http://localhost:3000
```

Otevři, přihlas se svým heslem. Měl bys vidět prázdné zóny a tlačítko **+ Lísteček**.
Přidej pár lístečků, přetahuj je, vyzkoušej ✓ hotovo a 📝 poznámku.

## 5. Nasazení na Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → naimportuj repo
   (nebo z CLI: `npm i -g vercel`, `vercel link`).
2. **Environment Variables** (Production): nastav **stejné 4 proměnné** jako v `.env.local`
   (`SESSION_PASSWORD`, `APP_PASSWORD_HASH`, `SUPABASE_URL`, `SUPABASE_KEY`).
3. Deploy:
   ```bash
   vercel deploy --prod
   ```
4. Hotovo — appka běží na `https://<projekt>.vercel.app`, zaheslovaná.

> Změna hesla později: `npm run hash -- "noveHeslo"` → přepiš `APP_PASSWORD_HASH` v env
> (lokálně i na Vercelu) → redeploy.

## 6. iPhone / PWA (volitelné)

1. Otevři appku v Safari → **Sdílet → Přidat na plochu**.
2. Ikona se vezme z `public/apple-touch-icon.png`.
3. Spusť z plochy a **přihlas se až uvnitř** (standalone má oddělené úložiště).
   Díky httpOnly cookie vydrží přihlášení měsíce.

## 7. (Volitelné) Napojení na Claude

- **Supabase MCP** v Claude Code / Cowork → agent vidí a mění board přímo v DB.
- Ať si agent přečte [`../AGENTS.md`](../AGENTS.md).
- Vyzkoušej příkaz `/scan-maily` (viz [`../.claude/commands/scan-maily.md`](../.claude/commands/scan-maily.md))
  na automatické doplnění úkolů z mailů.

---

## Časté potíže

| Problém | Řešení |
|---|---|
| Po přihlášení „Neautorizováno" / prázdno | Zkontroluj `SUPABASE_URL` + `SUPABASE_KEY` (musí být **service_role**). |
| Nejde se přihlásit | `APP_PASSWORD_HASH` musí být výstup z `npm run hash` (base64). Heslo zadáváš to původní. |
| Build/login chyba na session | `SESSION_PASSWORD` musí mít **32+ znaků**. |
| Lísteček nezmizí/nepřibude hned | Realtime je polling ~2,5 s → chvilku počkej nebo dej ↻ Aktualizovat. |
| Změna v DB se neukázala | Reload prohlížeče (realtime je zatím jen polling). |
