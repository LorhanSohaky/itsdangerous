import {wantBuffer} from './encoding.js';
import {BadPayload, BadSignature} from './errors.js';
import {makeKeysList, Signer, SignerOptions} from './signer.js';
import type {SecretKey, StringBuffer} from './types.js';

export interface DefaultSerializer {
  stringify(value: any): string;
  parse(value: any): any;
}

function isTextSerializer(serializer: DefaultSerializer): boolean {
  return typeof serializer.stringify({}) === 'string';
}

export interface SerializerOptions {
  secretKey: SecretKey;
  salt?: StringBuffer;
  serializer?: DefaultSerializer;
  signer?: typeof Signer;
  signerOpts?: Partial<SignerOptions>;
}

/**
 * A serializer wraps a `itsdangerous.signer.Signer` to enable serializing and securely signing data other than bytes.
 * It can unsign to verify that the data hasn't been changed.
 *
 * The serializer provides `stringify` and `parse`, similar to the `JSON` object, and by default uses `JSON` internally
 * to serialize the data to bytes.
 *
 * The secret key should be a random string of bytes and should not be saved to code or version control. Different salts
 * should be used to distinguish signing in different contexts.
 *
 * @param secretKey The secret key to sign and verify with. Can be a list of keys, oldest to newest, to support key
 *   rotation.
 * @param salt Extra key to combine with `secretKey` to distinguish signatures in different contexts.
 * @param serializer An object that provides `stringify` and `parse` methods for serializing data to a string. Defaults
 *   to `defaultSerializer`, which defaults to `JSON`.
 * @param signer A `Signer` class to instantiate when signing data. Defaults to `defaultSigner`, which defaults to
 *   `itsdangerous.signer.Signer`.
 * @param signerOpts Options to pass when instantiating the `Signer` class.
 */
export class Serializer {
  /**
   * The default serialization module to use to serialize data to a string internally. The default is `JSON`, but can be
   * changed to any object that provides `stringify` and `parse` methods.
   */
  defaultSerializer: DefaultSerializer = JSON;

  /**
   * The default `Signer` class to instantiate when signing data. The default is `itsdangerous.signer.Signer`.
   */
  defaultSigner = Signer;

  /**
   * The list of secret keys to try for verifying signatures, from oldest to newest. The newest (last) key is used for
   * signing.
   *
   * This allows a key rotation system to keep a list of allowed keys and remove expired ones.
   */
  secretKeys: Buffer[];
  salt: Buffer;
  serializer: DefaultSerializer;
  isTextSerializer: boolean;
  signer: typeof Signer;
  signerOpts: Partial<SignerOptions>;

  constructor({secretKey, salt = Buffer.from('itsdangerous'), serializer, signer, signerOpts}: SerializerOptions) {
    this.secretKeys = makeKeysList(secretKey);
    this.salt = wantBuffer(salt);
    this.serializer = serializer ?? this.defaultSerializer;
    this.isTextSerializer = isTextSerializer(this.serializer);
    this.signer = signer ?? this.defaultSigner;
    this.signerOpts = signerOpts ?? {};
  }

  /**
   * Parses the encoded object. This function throws `BadPayload` if the payload is not valid. The `serializer`
   * parameter can be used to override the serializer stored on the class. The encoded `payload` should always be a
   * Buffer.
   */
  parsePayload(payload: Buffer, serializer?: DefaultSerializer): any {
    serializer = serializer ?? this.serializer;
    const isText = serializer != null ? isTextSerializer(serializer) : this.isTextSerializer;
    try {
      return serializer.parse(isText ? payload.toString() : payload);
    } catch (error) {
      throw new BadPayload('Could not load the payload because an error occurred on unserializing the data.', error);
    }
  }

  /**
   * Stringifies the encoded object. The return value is always Buffer. If the internal serializer returns text, the
   * value will be encoded as utf8.
   */
  stringifyPayload(obj: any): Buffer {
    return wantBuffer(this.serializer.stringify(obj));
  }

  /**
   * Creates a new instance of the signer to be used. The default implementation uses the `Signer` base class.
   */
  makeSigner(salt?: StringBuffer): Signer {
    return new this.signer({secretKey: this.secretKeys, salt: salt ?? this.salt, ...this.signerOpts});
  }

  /**
   * Returns a signed string serialized with the internal serializer. The return value can be either a byte or unicode
   * string depending on the format of the internal serializer.
   */
  stringify(obj: any, salt?: StringBuffer): StringBuffer {
    const payload = wantBuffer(this.stringifyPayload(obj));
    const rv = this.makeSigner(salt).sign(payload);
    return this.isTextSerializer ? Buffer.from(rv.toString(), 'utf8') : rv;
  }

  /**
   * Reverse of `stringify`. Throws `BadSignature` if the signature validation fails.
   */
  parse(signed: StringBuffer, salt?: StringBuffer): any {
    signed = wantBuffer(signed);
    return this.parsePayload(this.makeSigner(salt).unsign(signed), this.serializer);
  }

  /**
   * Like `parse` but without verifying the signature. This is potentially very dangerous to use depending on how your
   * serializer works. The return value is `(signatureValid, payload)` instead of just the payload. The first item will
   * be a boolean that indicates if the signature is valid. This function never fails.
   *
   * Use it for debugging only and if you know that your serializer module is not exploitable (for example, do not use
   * it with a pickle serializer).
   */
  parseUnsafe(signed: StringBuffer, salt?: StringBuffer): [boolean, any] {
    try {
      return [true, this.parse(signed, salt)];
    } catch (error) {
      return this._handleParseUnsafeError(error);
    }
  }

  /**
   * Low-level helper function to implement `parseUnsafe` in serializer subclasses.
   */
  _handleParseUnsafeError(error: unknown): [boolean, any] {
    if (error instanceof BadSignature) {
      if (error.payload == null) {
        return [false, null];
      }
      try {
        return [false, this.parsePayload(error.payload, this.serializer)];
      } catch (error) {
        if (error instanceof BadPayload) {
          return [false, null];
        }
        throw error;
      }
    }
    throw error;
  }
}
