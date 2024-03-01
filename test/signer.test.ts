import {describe, expect, test} from 'vitest';
import {
  BadSignature,
  HMACAlgorithm,
  KeyDerivation,
  NoneAlgorithm,
  Signer,
  SignerOptions,
  SigningAlgorithm,
} from '../src';
import {rsplit} from '../src/utils';
import {withThrows} from './utils';

class ReverseAlgorithm extends SigningAlgorithm {
  override getSignature(key: Buffer, value: Buffer): Buffer {
    return Buffer.concat([key, value]).reverse();
  }
}

function signerFactory(options?: Partial<SignerOptions>): Signer {
  return new Signer({secretKey: 'secret-key', ...options});
}

describe('signer', () => {
  test('signer', () => {
    const signer = signerFactory();
    const signed = signer.sign('my string');
    expect(signed instanceof Buffer).toEqual(true);
    expect(signer.validate(signed)).toEqual(true);
    const out = signer.unsign(signed).toString();
    expect(out).toEqual('my string');
  });

  test('noSeparator', () => {
    const signer = signerFactory();
    const signed = signer.sign('my string').toString().replace(signer.sep.toString(), '*');
    expect(signer.validate(signed)).toEqual(false);
    expect(() => signer.unsign(signed)).toThrow(BadSignature);
  });

  test('brokenSignature', () => {
    const signer = signerFactory();
    const badSigned = signer.sign('b').subarray(0, -1);
    const badSig = rsplit(badSigned.toString(), '.', 1)[1];
    expect(signer.verifySignature(Buffer.from('b'), badSig)).toEqual(false);
    const error = withThrows(() => signer.unsign(badSigned), BadSignature);
    expect(error.payload).toEqual(Buffer.from('b'));
  });

  test('changedValue', () => {
    const signer = signerFactory();
    const signed = signer.sign('my string').toString().replace('my', 'other');
    expect(signer.validate(signed)).toEqual(false);
    expect(() => signer.unsign(signed)).toThrow(BadSignature);
  });

  test('invalidSeparator', () => {
    const error = withThrows(() => signerFactory({sep: '-'}), TypeError);
    expect(error.message).includes('separator cannot be used');
  });

  test.each([KeyDerivation.Concat, KeyDerivation.DjangoConcat, KeyDerivation.Hmac, KeyDerivation.None])(
    'keyDerivation',
    (keyDerivation) => {
      const signer = signerFactory({keyDerivation});
      expect(signer.unsign(signer.sign('value'))).toEqual(Buffer.from('value'));
    },
  );

  test('invalidKeyDerivation', () => {
    // @ts-expect-error ts(2322)
    const signer = signerFactory({keyDerivation: 'invalid'});
    expect(() => signer.deriveKey()).toThrow(TypeError);
  });

  test('digestMethod', () => {
    const signer = signerFactory({digestMethod: 'md5'});
    expect(signer.unsign(signer.sign('value'))).toEqual(Buffer.from('value'));
  });

  test.each([undefined, new NoneAlgorithm(), new HMACAlgorithm(), new ReverseAlgorithm()])('algorithm', (algorithm) => {
    const signer = signerFactory({algorithm});
    expect(signer.unsign(signer.sign('value'))).toEqual(Buffer.from('value'));
    if (algorithm == null) {
      expect(signer.algorithm.digestMethod).toEqual(signer.digestMethod);
    }
  });

  test('secretKeys', () => {
    let signer = new Signer({secretKey: 'a'});
    const signed = signer.sign('my string');
    expect(signed instanceof Buffer).toEqual(true);
    signer = new Signer({secretKey: ['a', 'b']});
    expect(signer.validate(signed)).toEqual(true);
    const out = signer.unsign(signed);
    expect(out).toEqual(Buffer.from('my string'));
  });
});
