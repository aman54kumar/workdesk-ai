/** Split compose body from Outlook signature; merge on insert. */

import {
  extractStyleFromHtml,
  extractSubjectLine,
  plainTextToOutlookHtml,
} from './outlook-rich-html';

export { extractSubjectLine };

const CLOSING_LINE =
  /^(thanks(?:\s+and\s+regards)?|regards|best regards|kind regards|sincerely|yours sincerely|cheers|warm regards),?\s*$/i;

const HTML_SIGNATURE_DIV =
  /<div[^>]*\bid\s*=\s*["']?signature["']?[^>]*>/i;

const HTML_SIGNATURE_MARKERS = [
  HTML_SIGNATURE_DIV,
  /<div[^>]*\bclass\s*=\s*["'][^"']*\bsignature\b[^"']*["'][^>]*>/i,
  /<div[^>]*data-smartmail\s*=\s*["']signature["'][^>]*>/i,
];

/** Where a plain-text signature block often starts (closing line). */
export function splitTextBodyAndSignature(text: string): {
  body: string;
  signature: string;
} {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let splitAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line === '--' || CLOSING_LINE.test(line)) {
      if (i > 0) splitAt = i;
    }
  }

  if (splitAt > 0) {
    return {
      body: lines.slice(0, splitAt).join('\n').trimEnd(),
      signature: lines.slice(splitAt).join('\n'),
    };
  }

  return { body: normalized.trimEnd(), signature: '' };
}

export function splitHtmlBodyAndSignature(html: string): {
  bodyHtml: string;
  signatureHtml: string;
} {
  for (const re of HTML_SIGNATURE_MARKERS) {
    const m = re.exec(html);
    if (m?.index != null && m.index > 0) {
      return {
        bodyHtml: html.slice(0, m.index).trimEnd(),
        signatureHtml: html.slice(m.index),
      };
    }
  }

  const text = htmlToApproxText(html);
  const { body, signature } = splitTextBodyAndSignature(text);
  if (!signature.trim()) {
    return { bodyHtml: html, signatureHtml: '' };
  }

  const closingInHtml = findClosingLineIndexInHtml(html, body);
  if (closingInHtml > 0) {
    return {
      bodyHtml: html.slice(0, closingInHtml).trimEnd(),
      signatureHtml: html.slice(closingInHtml),
    };
  }

  return { bodyHtml: html, signatureHtml: '' };
}

function htmlToApproxText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function findClosingLineIndexInHtml(html: string, bodyText: string): number {
  const lastLine = bodyText.split('\n').pop()?.trim() ?? '';
  if (!lastLine) return -1;
  const idx = html.toLowerCase().lastIndexOf(escapeHtml(lastLine).toLowerCase());
  if (idx < 0) {
    const plain = lastLine.slice(0, 20);
    return html.toLowerCase().lastIndexOf(plain.toLowerCase());
  }
  return idx;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Plain text → Outlook-friendly HTML (paragraphs, lists, bold). */
export function plainTextToHtml(text: string, styleSourceHtml = ''): string {
  const style = styleSourceHtml
    ? extractStyleFromHtml(styleSourceHtml)
    : undefined;
  return plainTextToOutlookHtml(text, style);
}

/** Remove Subject line and trailing signature from model output before insert. */
export function cleanGeneratedForInsert(generated: string): string {
  let t = generated.replace(/\r\n/g, '\n').trim();
  t = t.replace(/^Subject:\s*.+\n+/im, '');
  const { body } = splitTextBodyAndSignature(t);
  return body.trim();
}

export function mergeHtmlBodyAndSignature(
  bodyHtml: string,
  signatureHtml: string,
): string {
  if (!signatureHtml.trim()) return bodyHtml;
  const spacer = bodyHtml.trim() ? '<p style="margin:0 0 8pt 0;">&nbsp;</p>' : '';
  return `${bodyHtml}${spacer}${signatureHtml}`;
}
