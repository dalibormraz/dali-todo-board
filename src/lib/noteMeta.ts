// Z MD poznámky lístečku (`notes_md`) vytáhne rychlé akce: odkaz do Gmailu
// (vlákno konverzace) a telefonní číslo k zavolání. Čistě read-only nad textem,
// žádný zápis do DB — agent píše běžný markdown, frontend z něj jen odvodí tlačítka.
//
// Konvence, které agent do poznámky píše (viz AGENTS.md §3b):
//   • zdroj e-mailu: `Gmail thread <16hex>` nebo přímý odkaz `https://mail.google.com/...`
//   • kontakt: e-mailová adresa kdekoliv v textu
//   • telefon: `tel:+420…` odkaz, mezinárodní `+420 777 123 456` nebo skupinky 3-3-3

export interface GmailAction {
  url: string;
  label: string;
  detail: string;
}

export interface PhoneAction {
  href: string;
  display: string;
}

export interface NoteActions {
  gmail: GmailAction | null;
  phone: PhoneAction | null;
}

const GMAIL_BASE = "https://mail.google.com/mail/u/0/#";

// Přímý odkaz do Gmailu (nejpřesnější, použij as-is).
const RE_GMAIL_URL = /https?:\/\/mail\.google\.com\/[^\s)<>"'»]+/i;
// Gmail thread / message id (hex, 16–20 znaků) v kontextu slova „Gmail" nebo „thread".
const RE_THREAD =
  /(?:gmail[^\n]{0,40}?thread|thread\s*(?:id)?[:#]?\s*|gmail[^\n]{0,12}?id[:#]?\s*)\s*([0-9a-f]{16,20})\b/i;
// E-mailová adresa kdekoliv v textu (kvantifikátory ohraničené kvůli výkonu).
const RE_EMAIL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}/;
// Předmět v českých uvozovkách hned za zmínkou „Gmail".
// Pozn.: čeština zavírá „…“ (U+201C), proto je U+201C i v koncové třídě.
const RE_SUBJECT = /gmail[^\n]{0,30}?[„"“]([^"”“„\n]{3,80})["”“]/i;

// Telefon — bez lookbehind (kvůli starším Safari na iOS).
const RE_TEL_LINK = /tel:([+0-9 ().\-]{6,})/i;
const RE_INTL = /\+\d{1,3}[\s.\-]?(?:\d[\s.\-]?){7,12}\d/;
// Holé skupinkové 3-3-3 (bez +420): vyloučíme okolí typické pro čísla účtů / VS /
// objednávek — předchozí '-' nebo '/' (prefix účtu) a následné '/' (kód banky).
const RE_CZ_GROUPED = /(?:^|[^\d+\-/])((?:\+420[\s.\-]?)?\d{3}[\s.\-]\d{3}[\s.\-]\d{3})(?![\d/])/;

function extractGmail(md: string): GmailAction | null {
  const url = md.match(RE_GMAIL_URL);
  if (url) {
    return { url: url[0], label: "Otevřít v Gmailu", detail: "přímý odkaz" };
  }
  const thread = md.match(RE_THREAD);
  if (thread) {
    return {
      url: `${GMAIL_BASE}all/${thread[1]}`,
      label: "Otevřít vlákno v Gmailu",
      detail: `thread ${thread[1].slice(0, 8)}…`,
    };
  }
  const email = md.match(RE_EMAIL);
  if (email) {
    return {
      url: `${GMAIL_BASE}search/${encodeURIComponent(email[0])}`,
      label: "Najít konverzaci v Gmailu",
      detail: email[0],
    };
  }
  const subject = md.match(RE_SUBJECT);
  if (subject) {
    const subj = subject[1].trim();
    return {
      url: `${GMAIL_BASE}search/${encodeURIComponent(subj)}`,
      label: "Najít v Gmailu",
      detail: `„${subj.length > 28 ? subj.slice(0, 28) + "…" : subj}"`,
    };
  }
  return null;
}

function toTelHref(raw: string): string {
  // ponech vedoucí +, jinak jen číslice
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return `tel:${plus}${trimmed.replace(/[^\d]/g, "")}`;
}

function extractPhone(md: string): PhoneAction | null {
  const tel = md.match(RE_TEL_LINK);
  if (tel) {
    const display = tel[1].trim();
    return { href: toTelHref(display), display };
  }
  const intl = md.match(RE_INTL);
  if (intl) {
    const display = intl[0].trim();
    return { href: toTelHref(display), display };
  }
  const cz = md.match(RE_CZ_GROUPED);
  if (cz) {
    const display = cz[1].trim();
    return { href: toTelHref(display), display };
  }
  return null;
}

export function noteActions(md: string | null | undefined): NoteActions {
  if (!md || !md.trim()) return { gmail: null, phone: null };
  return { gmail: extractGmail(md), phone: extractPhone(md) };
}

// Lehká varianta pro lísteček: jen příznaky, ať TaskNode neřeší URL.
export function noteFlags(md: string | null | undefined): {
  hasMail: boolean;
  hasPhone: boolean;
} {
  const a = noteActions(md);
  return { hasMail: a.gmail !== null, hasPhone: a.phone !== null };
}
