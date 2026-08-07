import { deriveClientOrderId } from './client-order-id';

describe('deriveClientOrderId', () => {
  it('is deterministic for the same intent', () => {
    expect(deriveClientOrderId('user-1', 'signal-abc')).toBe(
      deriveClientOrderId('user-1', 'signal-abc'),
    );
  });

  it('separates intents and owners', () => {
    expect(deriveClientOrderId('user-1', 'a')).not.toBe(
      deriveClientOrderId('user-1', 'b'),
    );
    expect(deriveClientOrderId('user-1', 'a')).not.toBe(
      deriveClientOrderId('user-2', 'a'),
    );
  });

  it('cannot be forged by shifting the separator', () => {
    // "user-1" + "a:b" must not collide with "user-1:a" + "b".
    expect(deriveClientOrderId('user-1', 'a:b')).not.toBe(
      deriveClientOrderId('user-1:a', 'b'),
    );
  });

  it('fits the 36-char limit both exchanges impose', () => {
    const id = deriveClientOrderId('a'.repeat(200), 'b'.repeat(200));
    expect(id.length).toBeLessThanOrEqual(36);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
