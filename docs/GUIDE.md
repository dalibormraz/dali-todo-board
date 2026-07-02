# 🎯 GUIDE — jak DALI TODO používat efektivně

Nástroj je jednoduchý schválně. Síla je v **návycích**. Tady je, jak z něj vytěžit nejvíc.

---

## 1. Mysli v zónách, ne v seznamu

Zóny nejsou složky — jsou to **stavy pozornosti**:

| Zóna | Patří sem | Tip |
|---|---|---|
| **HOŘÍ** | dnes/zítra, deadline na spadnutí | Drž tu max 3–5 věcí. Když je tu 15, nehoří nic. |
| **TENTO TÝDEN** | konkrétní akce s blízkým termínem | Sem ráno přetáhneš, co dnes chceš posunout. |
| **PROJEKTY** | velké rozjeté věci (kontejnery) | Ne dílčí úkoly — ty patří do týdne/backlogu. |
| **BACKLOG** | někdy / až bude čas | Bez termínu. Sklad nápadů-závazků. |
| **NÁPADY** | nápad, ne závazek | Nenutí tě nic udělat. |
| **RODINA** | osobní / dům / zahrada / děti | Oddělené od práce. |
| **PRO CLAUDE** | „tohle vyřeš ty, AI" | Viz níže — agent inbox. |
| **HOTOVO ✓** | dokončené | Sem to padá samo po odškrtnutí. |

**Rituál:** ráno přetáhni 2–3 věci do HOŘÍ/TENTO TÝDEN. Večer odškrtni hotové (klik na kolečko).

## 2. Barva = význam (ne dekorace)

- 🟨 `yellow` — běžný úkol „udělat".
- 🩷 `pink` — **čeká na akci/odpověď/termín** (míč je u někoho jiného, nebo se blíží datum).
- 🟦 `sky` — **info/poznámka** (není to úkol, ale nechci to ztratit).
- 🟩 `green` — volně (např. osobní).

Když projíždíš board, barvy ti dají rytmus: růžové = „hlídat", žluté = „makat".

## 3. Poznámka (`notes_md`) je tvoje druhá paměť

Každý lísteček má za sebou **Markdown poznámku** (ikonka 📝 na vybraném lístečku).
Piš tam vše, co by ti — nebo agentovi — pomohlo úkol dořešit bez dohledávání:

```markdown
## Kontext
- **Od:** Jana Nováková (jana@example.com), 24. 6.
- **O co jde:** chce nabídku na školení do pátku.
- **Data:** rozpočet ~40 000, 12 lidí, online.
- **Další krok:** poslat nabídku z šablony + termín.
```

Čím bohatší poznámka, tím spíš to **Claude zvládne vyřešit sám**.

### Rychlé akce z poznámky ✉️ 📞

Frontend si z textu poznámky **sám vytáhne** akce a nabídne je jako tlačítka:

- **Otevřít vlákno v Gmailu** — když do poznámky napíšeš jednu z:
  - přímý odkaz `https://mail.google.com/...`
  - `Gmail thread <id>` (16místné hex id vlákna) → otevře **rovnou tu konverzaci**
  - e-mailovou adresu → „najít v Gmailu"
- **Zavolat `<číslo>`** — napiš `tel:+420…`, `+420 777 123 456` nebo skupinky `777 123 456`.

Na lístečku se navíc vlevo… vlastně **dole vpravo** objeví nenápadné ikonky ✉️/📞,
takže na první pohled vidíš „sem mám odepsat / zavolat".

## 4. Deleguj na Claude (agent inbox)

Zóna **PRO CLAUDE** je inbox pro AI:

1. Hodíš tam lísteček (ideálně s poznámkou, co se má udělat).
2. Agent (Claude Code / Cowork přes Supabase MCP) ho **převezme**
   (`status: queued_for_agent → agent_working`), udělá práci (rešerše, draft, kód…),
   zapíše `result_note` (co udělal) a přesune do **HOTOVO**.
3. Ty jen zkontroluješ výsledek.

Detail konvencí je v [`../AGENTS.md`](../AGENTS.md).

## 5. Skener mailů → board

Příkaz [`/scan-maily`](../.claude/commands/scan-maily.md) (v Claude Code) projde posledních
N mailů, **porovná je s celým boardem** (otevřené i hotové) a:

- nové akční věci **dopíše** jako lístečky + bohatý MD kontext,
- k existujícím případně **doplní** kontext z mailu,
- **nikdy nic nesmaže ani nezduplikuje** a úkoly **neodbavuje** (jen třídí).

Skvělé na pravidelný „inbox zero" — jednou denně/týdně to projedeš a board je aktuální.

## 6. Klávesy a ovládání

| Akce | Jak |
|---|---|
| Posun plátna | táhni prázdnou plochu / dva prsty na trackpadu |
| Zoom | pinch / tlačítka +/− vlevo dole |
| Přejmenovat lísteček | dvojklik |
| Hotovo / vrátit | klik na kolečko vpravo nahoře |
| Barva / poznámka / smazat | vyber lísteček → lišta dole |
| Zpět / Vpřed | ⌘Z / ⌘⇧Z |
| Aktualizovat (načíst nejnovější) | ↻ vlevo nahoře |

## 7. Pár principů, proč to funguje

- **Tečky na pozadí stojí** (nehýbou se s plátnem) → pevný orientační rastr.
- **Při odzoomu** se lístečky kreslí nalehko (LOD), aby plátno se 100+ úkoly neškubalo.
- **Hotové se skládají** do mřížky v HOTOVO → archiv nepřekáží, ale je po ruce.
- **Jeden zdroj pravdy** (Supabase) → stejná data z appky, mobilu i od agenta.
