import { describe, expect, it } from 'vitest';
import { tokenizeWhatsAppRichText } from './whatsappRichText';

describe('tokenizeWhatsAppRichText', () => {
  it('keeps a phone number as one token instead of repeating regex capture groups', () => {
    expect(tokenizeWhatsAppRichText('54991811902')).toEqual([
      { type: 'phone', value: '54991811902' },
    ]);
  });

  it('preserves text around a phone number and a URL exactly once', () => {
    expect(tokenizeWhatsAppRichText('Ligue 54991811902 ou acesse www.example.com')).toEqual([
      { type: 'text', value: 'Ligue ' },
      { type: 'phone', value: '54991811902' },
      { type: 'text', value: ' ou acesse ' },
      { type: 'url', value: 'www.example.com' },
    ]);
  });

  it('does not extract a phone from a longer digit sequence', () => {
    expect(tokenizeWhatsAppRichText('5499181190254991811902')).toEqual([
      { type: 'text', value: '5499181190254991811902' },
    ]);
  });
});
