/**
 * Thrown if bad data of any sort was encountered. This is the base for all
 * errors that ItsDangerous defines.
 */
export class BadData extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown if a signature does not match.
 */
export class BadSignature extends BadData {
  /**
   * The payload that failed the signature test. In some situations you might
   * still want to inspect this, even if you know it was tampered with.
   */
  payload: any;

  constructor(message: string, payload?: any) {
    super(message);
    this.payload = payload;
  }
}

/**
 * Thrown if a time-based signature is invalid. This is a subclass of
 * `BadSignature`.
 */
export class BadTimeSignature extends BadSignature {
  /**
   * If the signature expired this exposes the date of when the signature was
   * created. This can be helpful in order to tell the user how long a link has
   * been gone stale.
   */
  dateSigned: Date;

  constructor(message: string, payload?: any, dateSigned?: any) {
    super(message, payload);
    this.dateSigned = dateSigned;
  }
}

/**
 * Thrown if a signature timestamp is older than `maxAge`. This is a subclass of
 * `BadTimeSignature`.
 */
export class SignatureExpired extends BadTimeSignature {}

/**
 * Thrown if a signed header is invalid in some form. This only happens for
 * serializers that have a header that goes with the signature.
 */
export class BadHeader extends BadSignature {
  /**
   * If the header is actually available but just malformed it might be stored
   * here.
   */
  header: any;

  /**
   * If available, the error that indicates why the payload was not valid. This
   * might be `undefined`.
   */
  originalError: any;

  constructor(message: string, payload?: any, header?: any, originalError?: any) {
    super(message, payload);
    this.header = header;
    this.originalError = originalError;
  }
}

/**
 * Thrown if a payload is invalid. This could happen if the payload is loaded
 * despite an invalid signature, or if there is a mismatch between the
 * serializer and deserializer. The original error that occurred during loading
 * is stored on as `originalError`.
 */
export class BadPayload extends BadData {
  /**
   * If available, the error that indicates why the payload was not valid. This
   * might be `undefined`.
   */
  originalError: any;

  constructor(message: string, originalError?: any) {
    super(message);
    this.originalError = originalError;
  }
}
