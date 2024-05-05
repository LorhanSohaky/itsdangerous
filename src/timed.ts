import assert from 'node:assert';
import {Buffer} from 'node:buffer';
import {base64Decode, base64Encode, bufferToInt, intToBuffer, wantBuffer} from './encoding.ts';
import {BadSignatureError, BadTimeSignatureError, SignatureExpiredError} from './errors.ts';
import {Serializer} from './serializer.ts';
import {Signer} from './signer.ts';
import type {StringBuffer} from './types.ts';
import {rsplit} from './utils.ts';

/**
 * Custom type guard to check if an object is an instance of TimestampSigner.
 */
function isTimestampSigner(signer: Signer): signer is TimestampSigner {
  return 'getTimestamp' in signer && 'timestampToDate' in signer && 'unsign' in signer;
}

/**
 * Works like the regular `Signer` but also records the time of the signing and
 * can be used to expire signatures. The `unsign` method can throw
 * `SignatureExpired` if the unsigning failed because the signature is expired.
 */
export class TimestampSigner extends Signer {
  /**
   * Returns the current timestamp. The function must return an integer.
   */
  public getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Convert the timestamp from `getTimestamp` into a `Date` object.
   */
  public timestampToDate(timestamp: number): Date {
    const date = new Date(timestamp * 1000);
    if (Number.isNaN(date.getTime())) {
      throw new TypeError('Invalid timestamp');
    }
    return date;
  }

  /**
   * Signs the given string and also attaches time information.
   */
  public override sign(value: StringBuffer): Buffer {
    value = wantBuffer(value);
    const timestamp = base64Encode(intToBuffer(this.getTimestamp()));
    const sep = wantBuffer(this.sep);
    value = Buffer.concat([value, sep, timestamp]);
    return Buffer.concat([value, sep, this.getSignature(value)]);
  }

  /**
   * Works like the regular `Signer.unsign` but can also validate the time. See
   * the base comment of the class for the general behavior. If
   * `returnTimestamp` is `true` the timestamp of the signature will be returned
   * as a `Date` object.
   */
  public override unsign(signedValue: StringBuffer, maxAge?: number, returnTimestamp?: false): Buffer;
  // eslint-disable-next-line no-dupe-class-members
  public override unsign(signedValue: StringBuffer, maxAge?: number, returnTimestamp?: true): [Buffer, Date];
  // eslint-disable-next-line no-dupe-class-members
  public override unsign(signedValue: StringBuffer, maxAge?: number, returnTimestamp = false): Buffer | [Buffer, Date] {
    let result: Buffer | undefined;
    let sigError: BadSignatureError | null = null;
    try {
      result = super.unsign(signedValue);
      sigError = null;
    } catch (error) {
      if (error instanceof BadSignatureError) {
        sigError = error;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        result = error.payload;
      } else {
        throw error;
      }
    }
    result ??= Buffer.from('');
    const sep = wantBuffer(this.sep);
    if (!result.includes(sep)) {
      if (sigError != null) {
        throw sigError;
      }
      throw new BadTimeSignatureError('Missing timestamp', result);
    }
    const [value, timestampBuffer] = rsplit(result, sep, 1) as [Buffer, Buffer];
    let timestampInt: number | undefined;
    let timestampDate: Date | undefined;
    try {
      timestampInt = Number(bufferToInt(base64Decode(timestampBuffer)));
    } catch {
      /* noop */
    }
    if (sigError != null) {
      if (timestampInt != null) {
        try {
          timestampDate = this.timestampToDate(timestampInt);
        } catch (error) {
          if (error instanceof TypeError) {
            throw new BadTimeSignatureError('Malformed timestamp', value);
          }
          throw error;
        }
      }
      throw new BadTimeSignatureError(sigError.message, value, timestampDate);
    }
    if (Number.isNaN(timestampInt) || timestampInt == null) {
      throw new BadTimeSignatureError('Malformed timestamp', value);
    }
    if (maxAge != null) {
      const age = this.getTimestamp() - timestampInt;
      if (age > maxAge) {
        throw new SignatureExpiredError(
          `Signature age ${age} > ${maxAge} seconds`,
          value,
          this.timestampToDate(timestampInt),
        );
      }
      if (age < 0) {
        throw new SignatureExpiredError(`Signature age ${age} < 0 seconds`, value, this.timestampToDate(timestampInt));
      }
    }
    if (returnTimestamp) {
      return [value, this.timestampToDate(timestampInt)];
    }
    return value;
  }

  /**
   * Only validates the given signed value. Returns `true` if the signature
   * exists and is valid.
   */
  public override validate(signedValue: StringBuffer, maxAge?: number): boolean {
    try {
      this.unsign(signedValue, maxAge);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Uses `TimestampSigner` instead of the default `Signer`.
 */
export class TimedSerializer extends Serializer {
  public override signer = TimestampSigner;

  /**
   * Reverse of `stringify`, throws `BadSignature` if the signature validation
   * fails. If a `maxAge` is provided it will ensure the signature is not older
   * than that time in seconds. In case the signature is outdated,
   * `SignatureExpired` is thrown. All arguments are forwarded to the signer's
   * `TimestampSigner.unsign` method.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override parse(signed: StringBuffer, salt?: StringBuffer, maxAge?: number, returnTimestamp = false): any {
    signed = wantBuffer(signed);
    const signer = this.makeSigner(salt);
    assert(isTimestampSigner(signer));
    const [base64d, timestamp] = signer.unsign(signed, maxAge, true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const payload = this.parsePayload(base64d);
    if (returnTimestamp) {
      return [payload, timestamp];
    }
    return payload;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override parseUnsafe(signed: StringBuffer, salt?: StringBuffer, maxAge?: number): [boolean, any] {
    try {
      return [true, this.parse(signed, salt, maxAge)];
    } catch (error) {
      return this._handleParseUnsafeError(error);
    }
  }
}
