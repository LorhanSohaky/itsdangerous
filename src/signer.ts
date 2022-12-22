import crypto from 'node:crypto';
import {base64Decode, base64Encode, BASE64_ALPHABET, wantBuffer} from './encoding.js';
import {BadSignature} from './errors.js';
import type {SecretKey, StringBuffer} from './types.js';
import {rsplit} from './utils.js';

/**
 * Subclasses must implement `getSignature` to provide signature generation functionality.
 */
export class SigningAlgorithm {
  digestMethod?: string;

  getSignature(_key: Buffer, _value: Buffer): Buffer {
    throw new Error('Not implemented');
  }

  verifySignature(key: Buffer, value: Buffer, sig: Buffer): boolean {
    try {
      return crypto.timingSafeEqual(sig, this.getSignature(key, value));
    } catch {
      return false;
    }
  }
}

/**
 * Provides an algorithm that does not perform any signing and returns an empty signature.
 */
export class NoneAlgorithm extends SigningAlgorithm {
  override getSignature(_key: Buffer, _value: Buffer): Buffer {
    return Buffer.from('');
  }
}

/**
 * Provides signature generation using HMACs.
 */
export class HMACAlgorithm extends SigningAlgorithm {
  override digestMethod: string;

  /**
   * The digest method to use with the MAC algorithm. This defaults to SHA1, but can be changed to any other method
   * supported by the `crypto` module.
   */
  defaultDigestMethod = 'sha1';

  constructor(digestMethod?: string) {
    super();
    this.digestMethod = digestMethod ?? this.defaultDigestMethod;
  }

  override getSignature(key: Buffer, value: Buffer): Buffer {
    const mac = crypto.createHmac(this.digestMethod, key).update(value);
    return mac.digest();
  }
}

export function makeKeysList(secretKey: SecretKey): Buffer[] {
  if (typeof secretKey === 'string' || Buffer.isBuffer(secretKey)) {
    return [wantBuffer(secretKey)];
  }
  return [...secretKey].map((x) => Buffer.from(x));
}

export enum KeyDerivation {
  Concat = 'concat',
  DjangoConcat = 'django-concat',
  Hmac = 'hmac',
  None = 'none',
}

export interface SignerOptions {
  secretKey: SecretKey;
  salt?: StringBuffer;
  sep?: StringBuffer;
  keyDerivation?: KeyDerivation;
  digestMethod?: string;
  algorithm?: SigningAlgorithm;
}

/**
 * A signer securely signs bytes, then unsigns them to verify that the value hasn't been changed.
 *
 * The secret key should be a random string of bytes and should not be saved to code or version control. Different salts
 * should be used to distinguish signing in different contexts.
 *
 * @param secretKey The secret key to sign and verify with. Can be a list of keys, oldest to newest, to support key
 * rotation.
 * @param salt Extra key to combine with `secretKey` to distinguish signatures in different contexts.
 * @param sep Separator between the signature and value.
 * @param keyDerivation How to derive the signing key from the secret key and salt. Possible values are `concat`,
 * `django-concat`, or `hmac`. Defaults to `defaultKeyDerivation`, which defaults to `django-concat`.
 * @param digestMethod Hash function to use when generating the HMAC signature. Defaults to `defaultDigestMethod`, which
 * defaults to `sha1`. Note that the security of the hash alone doesn't apply when used intermediately in HMAC.
 * @param algorithm A `SigningAlgorithm` instance to use instead of building a default `HMACAlgorithm` with the
 * `digestMethod`.
 */
export class Signer {
  /**
   * The digest method to use with the MAC algorithm. This defaults to SHA1, but can be changed to any other method
   * supported by the `crypto` module.
   */
  defaultDigestMethod = 'sha1';

  /**
   * The default scheme to use to derive the signing key from the secret key and salt. The default is `django-concat`.
   * Possible values are `concat`, `django-concat`, and `hmac`.
   */
  defaultKeyDerivation = KeyDerivation.DjangoConcat;

  /**
   * The list of secret keys to try for verifying signatures, from oldest to newest. The newest (last) key is used for
   * signing.
   *
   * This allows a key rotation system to keep a list of allowed keys and remove expired ones.
   */
  secretKeys: Buffer[];
  sep: Buffer;
  salt: Buffer;
  keyDerivation: KeyDerivation;
  digestMethod: string;
  algorithm: SigningAlgorithm;

  constructor({
    secretKey,
    salt = Buffer.from('itsdangerous.Signer'),
    sep = Buffer.from('.'),
    keyDerivation,
    digestMethod,
    algorithm,
  }: SignerOptions) {
    this.secretKeys = makeKeysList(secretKey);
    this.sep = wantBuffer(sep);

    if (BASE64_ALPHABET.includes(sep)) {
      throw new TypeError(
        'The given separator cannot be used because it may be' +
          ' contained in the signature itself. ASCII letters,' +
          " digits, and '-_=' must not be used.",
      );
    }

    this.salt = wantBuffer(salt);
    this.keyDerivation = keyDerivation ?? this.defaultKeyDerivation;
    this.digestMethod = digestMethod ?? this.defaultDigestMethod;
    this.algorithm = algorithm ?? new HMACAlgorithm(digestMethod);
  }

  /**
   * This method is called to derive the key. The default key derivation choices can be overridden here. Key derivation
   * is not intended to be used as a security method to make a complex key out of a short password. Instead you should
   * use large random secret keys.
   *
   * @param secretKey A specific secret key to derive from. Defaults to the last item in `secretKeys`.
   */
  deriveKey(secretKey?: StringBuffer): Buffer {
    secretKey = secretKey != null ? wantBuffer(secretKey) : this.secretKeys.at(-1)!;
    switch (this.keyDerivation) {
      case KeyDerivation.Concat: {
        return crypto
          .createHash(this.digestMethod)
          .update(Buffer.concat([this.salt, secretKey]))
          .digest();
      }
      case KeyDerivation.DjangoConcat: {
        return crypto
          .createHash(this.digestMethod)
          .update(Buffer.concat([this.salt, Buffer.from('signer'), secretKey]))
          .digest();
      }
      case KeyDerivation.Hmac: {
        const mac = crypto.createHmac(this.digestMethod, secretKey).update(this.salt);
        return mac.digest();
      }
      case KeyDerivation.None: {
        return secretKey;
      }
      default: {
        throw new TypeError(`Unknown key derivation method: ${this.keyDerivation}`);
      }
    }
  }

  /**
   * Returns the signature for the given value.
   */
  getSignature(value: StringBuffer): Buffer {
    return base64Encode(this.algorithm.getSignature(this.deriveKey(), wantBuffer(value)));
  }

  /**
   * Signs the given string.
   */
  sign(value: StringBuffer): Buffer {
    return Buffer.concat([wantBuffer(value), this.sep, this.getSignature(value)]);
  }

  /**
   * Verifies the signature for the given value.
   */
  verifySignature(value: StringBuffer, sig: StringBuffer): boolean {
    try {
      sig = base64Decode(sig);
    } catch {
      return false;
    }

    value = wantBuffer(value);
    for (const secretKey of this.secretKeys.reverse()) {
      const key = this.deriveKey(secretKey);
      if (this.algorithm.verifySignature(key, value, sig)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Unsigns the given string.
   */
  unsign(signedValue: StringBuffer): Buffer {
    signedValue = wantBuffer(signedValue);
    if (!signedValue.includes(this.sep)) {
      throw new BadSignature(`No '${this.sep}' found in value`);
    }

    const [value, sig] = rsplit(signedValue, this.sep, 1) as [Buffer, Buffer];
    if (!this.verifySignature(value, sig)) {
      throw new BadSignature(`Signature '${sig}' does not match`, value);
    }
    return value;
  }

  /**
   * Only validates the given signed value. Returns `true` if the signature exists and is valid.
   */
  validate(signedValue: StringBuffer): boolean {
    try {
      this.unsign(signedValue);
      return true;
    } catch (error) {
      if (error instanceof BadSignature) {
        return false;
      }
      throw error;
    }
  }
}
