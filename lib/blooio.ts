import crypto from 'crypto';

const BASE_URL = 'https://backend.blooio.com/v2/api';

/**
 * Verify a Blooio webhook signature against the raw request body.
 *
 * Blooio's docs describe two header shapes depending on the page:
 *  - `t={unixSeconds},v1={hex}` where the HMAC is over `{t}.{rawBody}` (Stripe-style)
 *  - a bare hex HMAC of the raw body
 * We support both so a docs/account discrepancy can't silently 401 every message.
 */
export function verifyBlooioSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const safeEqual = (a: string, b: string) => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  };

  // Stripe-style: t=...,v1=...
  if (signatureHeader.includes('v1=')) {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((p) => {
        const [k, ...rest] = p.trim().split('=');
        return [k, rest.join('=')];
      })
    );
    const timestamp = parts['t'];
    const provided = parts['v1'];
    if (!timestamp || !provided) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    return safeEqual(expected, provided);
  }

  // Bare hex HMAC of the raw body
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signatureHeader);
}

/**
 * Send an iMessage reply via Blooio. The recipient phone number is the chatId
 * and must be URL-encoded so the leading "+" survives.
 */
export async function sendImessage(to: string, text: string): Promise<void> {
  const apiKey = process.env.BLOOIO_API_KEY;
  if (!apiKey) throw new Error('BLOOIO_API_KEY is not set');

  const chatId = encodeURIComponent(to);
  const res = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Blooio send failed (${res.status}): ${detail}`);
  }
}
