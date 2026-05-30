function copyPlainFallback(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

function copyHtmlFallback(html: string, plain: string): boolean {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.setAttribute('contenteditable', 'true');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  const range = document.createRange();
  range.selectNodeContents(container);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const ok = document.execCommand('copy');
  selection?.removeAllRanges();
  document.body.removeChild(container);
  return ok || copyPlainFallback(plain);
}

export async function copyToClipboard(text: string, html?: string): Promise<boolean> {
  const plain = text ?? '';
  if (!plain.trim() && !html?.trim()) return false;

  if (html?.trim() && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch {
      // fall through to other strategies
    }
  }

  if (html?.trim()) {
    if (copyHtmlFallback(html, plain)) return true;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(plain);
      return true;
    } catch {
      // fall through
    }
  }

  return copyPlainFallback(plain);
}
