/**
 * Copy text to the clipboard with a fallback for non-secure contexts.
 *
 * `navigator.clipboard.writeText` only exists in a secure context (https or
 * localhost). The production app is served over plain http
 * (`http://10.126.126.2:3100`), where `navigator.clipboard` is undefined —
 * same class of pitfall as `crypto.randomUUID` (see .ai/worklog 2026-08-17).
 * Fall back to the legacy `document.execCommand('copy')` path there.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand copy failed');
  } finally {
    textarea.remove();
  }
}
