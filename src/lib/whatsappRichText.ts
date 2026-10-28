export type WhatsAppRichTextToken = {
  type: 'text' | 'url' | 'phone';
  value: string;
};

const richTextTokenRegex = /https?:\/\/[^\s]+|www\.[^\s]+|(?<!\d)\+?\d{1,2}\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}(?!\d)|(?<!\d)\d{10,13}(?!\d)/gi;
const urlTokenRegex = /^(?:https?:\/\/|www\.)/i;

export const tokenizeWhatsAppRichText = (text: string): WhatsAppRichTextToken[] => {
  if (!text) return [];

  // Do not use String.split with capturing groups here. Capturing subgroups in a
  // phone pattern are returned as extra array entries by split(), which made
  // parts of phone numbers appear repeatedly in rendered message bubbles.
  const tokens: WhatsAppRichTextToken[] = [];
  let cursor = 0;

  for (const match of text.matchAll(richTextTokenRegex)) {
    const value = match[0];
    const index = match.index ?? cursor;
    if (index > cursor) tokens.push({ type: 'text', value: text.slice(cursor, index) });
    tokens.push({ type: urlTokenRegex.test(value) ? 'url' : 'phone', value });
    cursor = index + value.length;
  }

  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });
  return tokens;
};
