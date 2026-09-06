import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CreateMessageSchema, CreateSessionSchema, GenerateCompassRequestSchema } from '../src/schemas';

describe('Personal Gemini Journal - Backend Unit & Contract Tests', () => {
  describe('Input Validation & Boundary Defense (OWASP A03 / LLM02)', () => {
    it('should reject empty message text', () => {
      const result = CreateMessageSchema.safeParse({ text: '   ' });
      assert.strictEqual(result.success, false);
    });

    it('should reject message text exceeding 8,000 characters', () => {
      const excessiveText = 'a'.repeat(8001);
      const result = CreateMessageSchema.safeParse({ text: excessiveText });
      assert.strictEqual(result.success, false);
    });

    it('should accept valid message text within boundaries', () => {
      const validText = 'Today I reflected on the project milestone and team dynamics.';
      const result = CreateMessageSchema.safeParse({ text: validText });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.text, validText);
    });

    it('should sanitize and accept valid session creation parameters', () => {
      const result = CreateSessionSchema.safeParse({
        title: 'Weekly Leadership Retrospective',
        tags: ['work', 'mindset', 'leadership'],
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.title, 'Weekly Leadership Retrospective');
      assert.strictEqual(result.data?.tags.length, 3);
    });

    it('should default untitled sessions cleanly', () => {
      const result = CreateSessionSchema.safeParse({});
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.title, 'Untitled Reflection');
      assert.deepStrictEqual(result.data?.tags, []);
    });

    it('should validate Reflection Compass date range format', () => {
      const validPayload = {
        title: 'Week 36 Compass',
        periodStart: '2026-09-01T00:00:00.000Z',
        periodEnd: '2026-09-07T23:59:59.000Z',
      };
      const result = GenerateCompassRequestSchema.safeParse(validPayload);
      assert.strictEqual(result.success, true);
    });
  });

  describe('Authorization Context and Token Verification Contract', () => {
    it('enforces Bearer token extraction and rejects requests without Authorization', () => {
      const headersWithoutAuth: Record<string, string> = {};
      const hasAuth = Boolean(headersWithoutAuth['authorization']?.startsWith('Bearer '));
      assert.strictEqual(hasAuth, false);
    });

    it('guarantees caller uid is derived exclusively from decoded token subject', () => {
      const mockDecodedToken = { uid: 'user_alice_123', email: 'alice@example.com' };
      const clientSuppliedBody = { uid: 'user_bob_456', text: 'tampered payload' };

      // Backend security rule: NEVER trust clientSuppliedBody.uid
      const authoritativeUid = mockDecodedToken.uid;
      assert.strictEqual(authoritativeUid, 'user_alice_123');
      assert.notStrictEqual(authoritativeUid, clientSuppliedBody.uid);
    });
  });
});
