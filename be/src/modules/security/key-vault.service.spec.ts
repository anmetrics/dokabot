import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { KeyVaultService } from './key-vault.service';

function makeVault(masterKey = randomBytes(32).toString('base64')) {
  const config = {
    get: (key: string) =>
      key === 'KEY_VAULT_MASTER_KEY' ? masterKey : 'test-key-v1',
  } as unknown as ConfigService;
  return new KeyVaultService(config);
}

describe('KeyVaultService', () => {
  const credentials = { apiKey: 'A'.repeat(64), apiSecret: 'S'.repeat(64) };

  it('round-trips credentials', () => {
    const vault = makeVault();
    const sealed = vault.seal(credentials);
    expect(vault.open(sealed)).toEqual(credentials);
  });

  it('never stores plaintext in the ciphertext bundle', () => {
    const sealed = makeVault().seal(credentials);
    const blob = JSON.stringify(sealed);
    expect(blob).not.toContain(credentials.apiKey);
    expect(blob).not.toContain(credentials.apiSecret);
  });

  it('uses a fresh data key per record', () => {
    const vault = makeVault();
    const a = vault.seal(credentials);
    const b = vault.seal(credentials);
    expect(a.wrappedDek).not.toEqual(b.wrappedDek);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('rejects a tampered ciphertext', () => {
    const vault = makeVault();
    const sealed = vault.seal(credentials);
    const flipped = Buffer.from(sealed.ciphertext, 'base64');
    flipped[0] ^= 0xff;
    expect(() =>
      vault.open({ ...sealed, ciphertext: flipped.toString('base64') }),
    ).toThrow();
  });

  it('cannot be opened with a different master key', () => {
    const sealed = makeVault().seal(credentials);
    expect(() => makeVault().open(sealed)).toThrow();
  });

  it('refuses a master key that is not 32 bytes', () => {
    expect(() => makeVault(randomBytes(16).toString('base64'))).toThrow(
      /32 bytes/,
    );
  });
});
