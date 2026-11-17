import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import { AuthConfig } from './auth.config.js';
import { JwtVerifier } from './jwt-verifier.js';

export const testConfig = new AuthConfig(
  'http://127.0.0.1:54321',
  'sb_publishable_test',
  'http://127.0.0.1:54321/auth/v1',
  'authenticated',
  'ES256',
  'postgresql://unused:unused@127.0.0.1:1/unused',
);
export const subject = 'a1234567-1234-4123-8123-123456789abc';

describe('ES256 verifier', () => {
  it('cryptographically accepts only trusted ES256 and required claims', async () => {
    const pair = await generateKeyPair('ES256');
    const other = await generateKeyPair('ES256');
    const keys = createLocalJWKSet({
      keys: [
        { ...(await exportJWK(pair.publicKey)), kid: 'trusted', alg: 'ES256' },
      ],
    });
    const verifier = new JwtVerifier(testConfig);
    const sign = (claims: JWTPayload = {}, key = pair.privateKey) =>
      new SignJWT({ role: 'authenticated', ...claims })
        .setProtectedHeader({ alg: 'ES256', kid: 'trusted' })
        .setSubject(subject)
        .setIssuer(testConfig.issuer)
        .setAudience(testConfig.audience)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(key);
    const valid = await sign();
    await expect(verifier.verify(valid, keys)).resolves.toEqual({
      id: subject,
      token: valid,
    });
    const variants: JWTPayload[] = [
      { sub: 'not-uuid' },
      { role: 'anon' },
      { role: 'service_role' },
      { iss: 'https://attacker.invalid' },
      { aud: 'other' },
      { exp: 1 },
      { nbf: Math.floor(Date.now() / 1000) + 3600 },
    ];
    // Build mutated claims after standard setters to test each actual rejection.
    for (const claims of variants) {
      const token = await new SignJWT({
        sub: subject,
        role: 'authenticated',
        iss: testConfig.issuer,
        aud: testConfig.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        ...claims,
      })
        .setProtectedHeader({ alg: 'ES256', kid: 'trusted' })
        .sign(pair.privateKey);
      await expect(verifier.verify(token, keys)).rejects.toMatchObject({
        status: 401,
      });
    }
    for (const missing of ['sub', 'exp', 'iat', 'role']) {
      const claims: JWTPayload = {
        sub: subject,
        role: 'authenticated',
        iss: testConfig.issuer,
        aud: testConfig.audience,
        iat: 1,
        exp: Math.floor(Date.now() / 1000) + 300,
      };
      delete claims[missing];
      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: 'ES256', kid: 'trusted' })
        .sign(pair.privateKey);
      await expect(verifier.verify(token, keys)).rejects.toMatchObject({
        status: 401,
      });
    }
    await expect(
      verifier.verify(await sign({}, other.privateKey), keys),
    ).rejects.toMatchObject({ status: 401 });
    const hs = await new SignJWT({ sub: subject })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new Uint8Array(32));
    await expect(verifier.verify(hs, keys)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      verifier.verify('eyJhbGciOiJub25lIn0.eyJzdWIiOiJhIn0.', keys),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      verifier.verify(`${valid.slice(0, -12)}tamperedxxxx`, keys),
    ).rejects.toMatchObject({ status: 401 });
  });
});
