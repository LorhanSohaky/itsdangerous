/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

/**
 * Thrown if bad data of any sort was encountered. This is the base for all
 * errors that ItsDangerous defines.
 */
export class BadDataError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'BadDataError';
  }
}

/**
 * Thrown if a signature does not match.
 */
export class BadSignatureError extends BadDataError {
  /**
   * The payload that failed the signature test. In some situations you might
   * still want to inspect this, even if you know it was tampered with.
   */
  public payload: any;

  public constructor(message: string, payload?: any) {
    super(message);
    this.payload = payload;
    this.name = 'BadSignatureError';
  }
}

/**
 * Thrown if a time-based signature is invalid. This is a subclass of
 * `BadSignature`.
 */
export class BadTimeSignatureError extends BadSignatureError {
  /**
   * If the signature expired this exposes the date of when the signature was
   * created. This can be helpful in order to tell the user how long a link has
   * been gone stale.
   */
  public dateSigned: Date;

  public constructor(message: string, payload?: any, dateSigned?: any) {
    super(message, payload);
    this.dateSigned = dateSigned;
    this.name = 'BadTimeSignatureError';
  }
}

/**
 * Thrown if a signature timestamp is older than `maxAge`. This is a subclass of
 * `BadTimeSignature`.
 */
export class SignatureExpiredError extends BadTimeSignatureError {
  public constructor(message: string, payload?: any, dateSigned?: any) {
    super(message, payload, dateSigned);
    this.name = 'SignatureExpiredError';
  }
}

/**
 * Thrown if a signed header is invalid in some form. This only happens for
 * serializers that have a header that goes with the signature.
 */
export class BadHeaderError extends BadSignatureError {
  /**
   * If the header is actually available but just malformed it might be stored
   * here.
   */
  public header: any;

  /**
   * If available, the error that indicates why the payload was not valid. This
   * might be `undefined`.
   */
  public originalError: any;

  public constructor(message: string, payload?: any, header?: any, originalError?: any) {
    super(message, payload);
    this.header = header;
    this.originalError = originalError;
    this.name = 'BadHeaderError';
  }
}

/**
 * Thrown if a payload is invalid. This could happen if the payload is loaded
 * despite an invalid signature, or if there is a mismatch between the
 * serializer and deserializer. The original error that occurred during loading
 * is stored on as `originalError`.
 */
export class BadPayloadError extends BadDataError {
  /**
   * If available, the error that indicates why the payload was not valid. This
   * might be `undefined`.
   */
  public originalError: any;

  public constructor(message: string, originalError?: any) {
    super(message);
    this.originalError = originalError;
    this.name = 'BadPayloadError';
  }
}
