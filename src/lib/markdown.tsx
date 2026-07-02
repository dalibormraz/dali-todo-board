import React from "react";

// Minimalistický, bezpečný Markdown → React renderer pro náhled poznámky lístečku.
// Záměrně NEpoužívá dangerouslySetInnerHTML — vrací React uzly, takže text je vždy
// escapovaný (žádné XSS). Pokrývá to, co do poznámek píše agent: nadpisy, tučné,
// kurzíva, inline/blok kód, citace, seznamy, odkazy a auto-linky (URL + e-mail).
// Když by cokoliv selhalo, spadne to na surový text v <pre> (náhled nikdy nerozbije popup).

const linkStyle: React.CSSProperties = {
  color: "#6b4eff",
  textDecoration: "underline",
  wordBreak: "break-word",
};
const codeStyle: React.CSSProperties = {
  background: "rgba(31,36,48,0.06)",
  borderRadius: 4,
  padding: "1px 5px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "0.92em",
};

function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  return null;
}

// ── inline (tučné, kurzíva, kód, odkazy, auto-linky) ────────────────────────
// POZOR: regex je stavový (/g). Protože inline() rekurzivně volá sám sebe (tučné
// uvnitř může mít kurzívu apod.), MUSÍ mít každé volání VLASTNÍ instanci — jinak
// by rekurze resetovala lastIndex sdíleného objektu a vnější smyčka by se zacyklila.
// Kvantifikátory u e-mailu jsou ohraničené ({1,64}@{1,255}) — neohraničené `+` by
// na jednom extrémně dlouhém slově bez '@' (např. nalepený base64) způsobilo O(n²)
// scan a zamrznutí náhledu. Reálné e-maily se do limitů pohodlně vejdou.
const INLINE_SRC =
  "(\\*\\*([^*]+)\\*\\*)|(`([^`]+)`)|(\\*([^*]+)\\*)|(_([^_]+)_)|(\\[([^\\]]+)\\]\\(([^)]+)\\))|(https?:\\/\\/[^\\s)<>\"']+)|([A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\\.[A-Za-z]{2,})";

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  // Pojistka proti patologickým řádkům: dlouhý řádek nerozebíráme inline (jen text).
  if (text.length > 5000) return [text];
  const re = new RegExp(INLINE_SRC, "g");
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${k++}`;
    if (m[2] != null) {
      nodes.push(<strong key={key}>{inline(m[2], key)}</strong>);
    } else if (m[4] != null) {
      nodes.push(
        <code key={key} style={codeStyle}>
          {m[4]}
        </code>,
      );
    } else if (m[6] != null) {
      nodes.push(<em key={key}>{inline(m[6], key)}</em>);
    } else if (m[8] != null) {
      nodes.push(<em key={key}>{inline(m[8], key)}</em>);
    } else if (m[10] != null) {
      const href = safeHref(m[11]);
      nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            {m[10]}
          </a>
        ) : (
          m[0]
        ),
      );
    } else if (m[12] != null) {
      nodes.push(
        <a key={key} href={m[12]} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          {m[12]}
        </a>,
      );
    } else if (m[13] != null) {
      nodes.push(
        <a key={key} href={`mailto:${m[13]}`} style={linkStyle}>
          {m[13]}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function withBreaks(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split("\n");
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push(<br key={`${keyPrefix}-br-${i}`} />);
    out.push(...inline(p, `${keyPrefix}-l${i}`));
  });
  return out;
}

// ── bloky ───────────────────────────────────────────────────────────────────
function parseBlocks(md: string): React.ReactNode {
  const lines = md.replace(/\r\n/g, "\n").replace(/\t/g, "    ").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // prázdné řádky
    if (line.trim() === "") {
      i++;
      continue;
    }

    // blok kódu ```
    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++; // přeskoč uzavírací ```
      blocks.push(
        <pre
          key={key++}
          style={{
            background: "rgba(31,36,48,0.06)",
            borderRadius: 8,
            padding: "10px 12px",
            overflowX: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 12.5,
            lineHeight: 1.5,
            margin: "6px 0",
          }}
        >
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }

    // nadpis #..######
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const sizes = [20, 18, 16, 15, 14, 13];
      blocks.push(
        <div
          key={key++}
          style={{
            fontSize: sizes[level - 1],
            fontWeight: 800,
            color: "#2a2c20",
            margin: level <= 2 ? "10px 0 4px" : "8px 0 2px",
            lineHeight: 1.3,
          }}
        >
          {inline(h[2], `h${key}`)}
        </div>,
      );
      i++;
      continue;
    }

    // citace >
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          style={{
            borderLeft: "3px solid rgba(107,78,255,0.4)",
            margin: "6px 0",
            padding: "2px 0 2px 12px",
            color: "#5b6473",
          }}
        >
          {withBreaks(buf.join("\n"), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    // číslovaný seznam
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} style={{ margin: "4px 0", paddingLeft: 22 }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ margin: "2px 0", lineHeight: 1.45 }}>
              {inline(it, `ol${key}-${idx}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // odrážkový seznam
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: "4px 0", paddingLeft: 20 }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ margin: "2px 0", lineHeight: 1.45 }}>
              {inline(it, `ul${key}-${idx}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // odstavec (slep souvislé neprázdné řádky, zachovej zalomení jako <br/>)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i].trim()) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} style={{ margin: "6px 0", lineHeight: 1.5 }}>
        {withBreaks(para.join("\n"), `p${key}`)}
      </p>,
    );
  }

  return blocks;
}

export function renderMarkdown(md: string): React.ReactNode {
  try {
    return parseBlocks(md);
  } catch {
    return (
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{md}</pre>
    );
  }
}
