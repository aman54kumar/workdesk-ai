/** Read/write compose message body via Office.js (HTML + signature preservation). */

import {
  cleanGeneratedForInsert,
  extractSubjectLine,
  mergeHtmlBodyAndSignature,
  plainTextToHtml,
  splitHtmlBodyAndSignature,
  splitTextBodyAndSignature,
} from './body-parts';

export interface MessageBodySnapshot {
  /** Text sent to the AI (signature excluded). */
  editableText: string;
  /** Plain text shown in the add-in preview. */
  previewText: string;
  signatureText: string;
  bodyHtml: string;
  signatureHtml: string;
  /** Full message for restore-original. */
  fullHtml: string;
  fullText: string;
}

export function isComposeAvailable(): boolean {
  try {
    const item = Office.context.mailbox.item;
    return !!item?.body;
  } catch {
    return false;
  }
}

function getBodyAsync<T>(coercion: Office.CoercionType): Promise<T> {
  return new Promise((resolve, reject) => {
    const item = Office.context.mailbox.item;
    if (!item?.body) {
      reject(new Error('Not in a compose message.'));
      return;
    }
    item.body.getAsync(coercion, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value as T);
      } else {
        reject(new Error(result.error?.message ?? 'Failed to read email body.'));
      }
    });
  });
}

function setBodyAsync(
  data: string,
  coercion: Office.CoercionType,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const item = Office.context.mailbox.item;
    if (!item?.body) {
      reject(new Error('Not in a compose message.'));
      return;
    }
    item.body.setAsync(data, { coercionType: coercion }, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve();
      } else {
        reject(new Error(result.error?.message ?? 'Failed to write email body.'));
      }
    });
  });
}

export async function getMessageBodySnapshot(): Promise<MessageBodySnapshot> {
  let fullHtml = '';
  let fullText = '';
  try {
    fullHtml = await getBodyAsync<string>(Office.CoercionType.Html);
  } catch {
    fullHtml = '';
  }
  try {
    fullText = await getBodyAsync<string>(Office.CoercionType.Text);
  } catch {
    fullText = '';
  }

  if (!fullHtml && fullText) {
    const split = splitTextBodyAndSignature(fullText);
    return {
      editableText: split.body,
      previewText: split.body,
      signatureText: split.signature,
      bodyHtml: plainTextToHtml(split.body),
      signatureHtml: split.signature ? plainTextToHtml(split.signature) : '',
      fullHtml: plainTextToHtml(fullText),
      fullText,
    };
  }

  const { bodyHtml, signatureHtml } = splitHtmlBodyAndSignature(fullHtml);
  const splitText = splitTextBodyAndSignature(fullText || '');
  const editableText = splitText.body;

  return {
    editableText: editableText.trim() ? editableText : splitText.body,
    previewText: editableText.trim() ? editableText : splitText.body,
    signatureText: splitText.signature,
    bodyHtml,
    signatureHtml,
    fullHtml: fullHtml || mergeHtmlBodyAndSignature(bodyHtml, signatureHtml),
    fullText,
  };
}

/** @deprecated Use getMessageBodySnapshot */
export async function getMessageBodyText(): Promise<string> {
  const snap = await getMessageBodySnapshot();
  return snap.editableText;
}

export async function setMessageBodyHtml(html: string): Promise<void> {
  await setBodyAsync(html, Office.CoercionType.Html);
}

export async function setMessageSubject(subject: string): Promise<void> {
  const item = Office.context.mailbox.item;
  if (!item?.subject) return;
  const trimmed = subject.trim();
  if (!trimmed) return;
  return new Promise((resolve, reject) => {
    item.subject.setAsync(trimmed, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve();
      } else {
        reject(new Error(result.error?.message ?? 'Failed to set subject.'));
      }
    });
  });
}

export async function insertGeneratedBody(
  generatedPlain: string,
  snapshot: MessageBodySnapshot,
): Promise<{ subjectSet?: string }> {
  const { subject, body: afterSubject } = extractSubjectLine(generatedPlain);
  const cleaned = cleanGeneratedForInsert(afterSubject);
  const styleSource = snapshot.bodyHtml || snapshot.fullHtml;
  const newBodyHtml = plainTextToHtml(cleaned, styleSource);

  if (subject) {
    try {
      await setMessageSubject(subject);
    } catch {
      /* subject field optional */
    }
  }

  if (snapshot.signatureHtml.trim()) {
    await setMessageBodyHtml(
      mergeHtmlBodyAndSignature(newBodyHtml, snapshot.signatureHtml),
    );
    return { subjectSet: subject };
  }

  if (snapshot.signatureText.trim()) {
    const mergedText = `${cleaned}\n\n${snapshot.signatureText.replace(/^\n+/, '')}`;
    await setBodyAsync(mergedText, Office.CoercionType.Text);
    return { subjectSet: subject };
  }

  await setMessageBodyHtml(newBodyHtml);
  return { subjectSet: subject };
}

export async function restoreMessageBody(snapshot: MessageBodySnapshot): Promise<void> {
  if (snapshot.fullHtml.trim()) {
    await setMessageBodyHtml(snapshot.fullHtml);
    return;
  }
  await setBodyAsync(snapshot.fullText, Office.CoercionType.Text);
}

/** @deprecated Prefer insertGeneratedBody / restoreMessageBody */
export async function setMessageBodyText(text: string): Promise<void> {
  await setBodyAsync(text, Office.CoercionType.Text);
}

export function waitForOffice(): Promise<void> {
  return new Promise((resolve) => {
    Office.onReady(() => resolve());
  });
}
