/**
 * Webhook signature verification
 */

import type { FastifyRequest } from 'fastify';
import type { FastifyReply } from 'fastify';
import pino from 'pino';

const logger = pino({ name: 'SignatureVerifier' });

// Extend FastifyRequest to include rawBody
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export interface SignatureVerifierConfig {
  secret: string;
  headerName?: string;
  algorithm?: 'sha256' | 'sha512';
}

/**
 * Verify webhook signatures
 */
export class SignatureVerifier {
  private readonly secret: string;
  private readonly headerName: string;
  private readonly algorithm: 'sha256' | 'sha512';

  constructor(config: SignatureVerifierConfig) {
    this.secret = config.secret;
    this.headerName = (config.headerName ?? 'x-webhook-signature').toLowerCase();
    this.algorithm = config.algorithm ?? 'sha256';

    logger.info({ headerName: this.headerName }, 'SignatureVerifier initialized');
  }

  /**
   * Verify request signature
   */
  async verify(request: FastifyRequest): Promise<boolean> {
    const headerValue = request.headers[this.headerName];
    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (typeof signature !== 'string' || signature.length === 0) {
      logger.warn('Missing signature header');
      return false;
    }

    try {
      // Get raw body
      const body = await this.getRawBody(request);

      // Compute expected signature
      const expected = await this.computeSignature(body);

      // Compare signatures using constant-time comparison
      const isValid = this.constantTimeCompare(signature, expected);

      if (!isValid) {
        logger.warn({ received: signature.slice(0, 20) }, 'Signature verification failed');
      }

      return isValid;
    } catch (error) {
      logger.error({ error }, 'Error verifying signature');
      return false;
    }
  }

  /**
   * Compute signature for body
   */
  async computeSignature(body: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(body);
    const key = encoder.encode(this.secret);
    const hashName = this.algorithm === 'sha512' ? 'SHA-512' : 'SHA-256';

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: hashName },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return `${this.algorithm}=${hashHex}`;
  }

  /**
   * Get raw body from request
   */
  private async getRawBody(request: FastifyRequest): Promise<string> {
    // Fastify already parses body, so we need raw body
    // This should be stored by a raw body parser middleware
    if (request.rawBody) {
      return request.rawBody;
    }

    if (typeof request.body === 'string') {
      return request.body;
    }

    if (request.raw.readableEnded || request.raw.destroyed) {
      return '';
    }

    // Fallback: try to read from stream
    return new Promise((resolve, reject) => {
      let body = '';
      request.raw.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.raw.on('end', () => resolve(body));
      request.raw.on('error', reject);
    });
  }

  /**
   * Constant-time string comparison
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

/**
 * Middleware factory for signature verification
 */
export function createSignatureMiddleware(verifier: SignatureVerifier) {
  return async function signatureMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const isValid = await verifier.verify(request);

    if (!isValid) {
      return reply.code(401).send({
        error: 'Invalid signature',
        message: 'Request signature verification failed',
      });
    }

    // Continue to next handler
  };
}
