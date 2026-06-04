/** Convert plain-text email output to HTML that Outlook/Word renders well. */

export interface OutlookTextStyle {
  fontFamily: string;
  fontSize: string;
  color: string;
}

const DEFAULT_STYLE: OutlookTextStyle = {
  fontFamily: 'Aptos, sans-serif',
  fontSize: '12pt',
  color: '#000000',
};

/** Reuse font/size from the user's existing compose HTML when possible. */
export function extractStyleFromHtml(html: string): OutlookTextStyle {
  const style: OutlookTextStyle = { ...DEFAULT_STYLE };
  const family =
    html.match(/font-family:\s*([^;}"']+)/i) ??
    html.match(/face="([^"]+)"/i);
  if (family?.[1]) {
    style.fontFamily = family[1].trim().replace(/&quot;/g, '"');
  }
  const size = html.match(/font-size:\s*([^;}"']+)/i);
  if (size?.[1]) style.fontSize = size[1].trim();
  const color = html.match(/(?:^|;)\s*color:\s*([^;}"']+)/i);
  if (color?.[1]) style.color = color[1].trim();
  return style;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Word/Outlook renders bold more reliably with inline font-weight than bare &lt;b&gt;. */
export function boldSpan(innerHtml: string): string {
  return `<span style="font-weight:bold;">${innerHtml}</span>`;
}

/**
 * Add **markers** for common emphasis patterns so HTML gets bold even if the model skips markdown.
 */
export function enrichBoldMarkers(text: string): string {
  let s = text;

  // [Project Name] placeholders
  s = s.replace(/\[([^\]]+)\]/g, '**$1**');

  // Dear Name, → Dear **Name**,
  s = s.replace(
    /^(Dear\s+)([^,\n]+)(,)/im,
    (_m, dear, name, comma) => `${dear}**${name.trim()}**${comma}`,
  );

  // Bullet or paragraph lead-in before colon (short label only)
  s = s.replace(
    /^(-\s+)?([A-Za-z][A-Za-z0-9\s/&-]{0,48}):\s+/gm,
    (_m, bullet, label) => `${bullet ?? ''}**${label.trim()}:** `,
  );

  // Standalone lines that are clearly labels
  s = s.replace(
    /^(Action required|Next steps|Key points|Attachments?|Timeline|Deadline):\s*$/gim,
    '**$1:**',
  );

  return s;
}

/** Inline **bold**, *italic* → Outlook-friendly spans. */
export function formatInlineRich(text: string): string {
  let s = enrichBoldMarkers(text);
  s = escapeHtml(s);
  s = s.replace(/\*\*(.+?)\*\*/g, (_m, inner) => boldSpan(inner));
  s = s.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<i>$1</i>');
  return s;
}

function pStyle(style: OutlookTextStyle): string {
  return `margin:0 0 8pt 0;font-size:${style.fontSize};font-family:${style.fontFamily};color:${style.color};`;
}

function liStyle(style: OutlookTextStyle): string {
  return `margin:0 0 4pt 0;font-size:${style.fontSize};font-family:${style.fontFamily};color:${style.color};`;
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^[-*•]\s+/, '').trim());
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\d+[.)]\s+/, '').trim());
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^[-*•]\s+/.test(lines[i] ?? '') &&
      !/^\d+[.)]\s+/.test(lines[i] ?? '')
    ) {
      paraLines.push(lines[i] ?? '');
      i++;
    }
    blocks.push({ kind: 'p', lines: paraLines });
  }

  return blocks;
}

export function plainTextToOutlookHtml(
  text: string,
  style: OutlookTextStyle = DEFAULT_STYLE,
): string {
  const blocks = parseBlocks(text.trim());
  if (blocks.length === 0) return '';

  const parts: string[] = [];

  for (const block of blocks) {
    if (block.kind === 'ul') {
      parts.push(
        `<ul style="margin:0 0 8pt 0;padding-left:24pt;">${block.items
          .map(
            (item) =>
              `<li style="${liStyle(style)}">${formatInlineRich(item)}</li>`,
          )
          .join('')}</ul>`,
      );
      continue;
    }
    if (block.kind === 'ol') {
      parts.push(
        `<ol style="margin:0 0 8pt 0;padding-left:24pt;">${block.items
          .map(
            (item) =>
              `<li style="${liStyle(style)}">${formatInlineRich(item)}</li>`,
          )
          .join('')}</ol>`,
      );
      continue;
    }
    for (const line of block.lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        parts.push(`<p style="${pStyle(style)}">&nbsp;</p>`);
        continue;
      }
      parts.push(
        `<p style="${pStyle(style)}">${formatInlineRich(trimmed)}</p>`,
      );
    }
  }

  const inner = parts.join('');
  return (
    `<div style="font-size:${style.fontSize};font-family:${style.fontFamily};color:${style.color};">` +
    `${inner}</div>`
  );
}

export function extractSubjectLine(text: string): {
  subject?: string;
  body: string;
} {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const match = normalized.match(/^Subject:\s*(.+?)(?:\n|$)/im);
  if (!match) return { body: normalized };
  return {
    subject: match[1].trim(),
    body: normalized.replace(/^Subject:\s*.+\n+/im, '').trim(),
  };
}
