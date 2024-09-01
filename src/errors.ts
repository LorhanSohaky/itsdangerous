import type {$TsFixMe} from './types.ts';

/**
 * Base class for errors that are thrown when encountering invalid or corrupted
 * data. This class serves as the foundation for all specific error types
 * defined in this module.
 */
export class BadDataError extends Error {
	/**
	 * Constructs a new `BadDataError` instance.
	 * @param {string} message - A descriptive error message explaining the nature
	 * of the bad data encountered.
	 */
	constructor(message: string) {
		super(message);
		this.name = 'BadDataError';
	}
}

/**
 * Error thrown when a data signature does not match the expected value. This
 * error provides access to the original payload, which may still hold value
 * despite the tampering indicated by the invalid signature.
 */
export class BadSignatureError extends BadDataError {
	/**
	 * The original payload that failed signature verification.
	 */
	public payload: Uint8Array;

	/**
	 * Constructs a new `BadSignatureError` instance.
	 * @param {string} message - A descriptive error message explaining the
	 * signature verification failure.
	 * @param {Uint8Array} payload - The original payload that caused the error.
	 */
	constructor(message: string, payload: Uint8Array) {
		super(message);
		this.payload = payload;
		this.name = 'BadSignatureError';
	}
}

/**
 * Error thrown when a time-based signature is invalid, typically due to an
 * incorrect or expired timestamp. Extends `BadSignatureError` and adds a
 * timestamp indicating when the data was originally signed.
 */
export class BadTimeSignatureError extends BadSignatureError {
	/**
	 * The date and time when the data was signed, if available.
	 */
	public dateSigned?: Date;

	/**
	 * Constructs a new `BadTimeSignatureError` instance.
	 * @param {string} message - A descriptive error message explaining the
	 * time-based signature failure.
	 * @param {Uint8Array} payload - The original payload that caused the error.
	 * @param {Date} [dateSigned] - Optional date indicating when the payload was
	 * signed.
	 */
	constructor(message: string, payload: Uint8Array, dateSigned?: Date) {
		super(message, payload);
		this.dateSigned = dateSigned;
	}
}

/**
 * Error thrown when a signature has expired. This occurs when a signature is
 * valid only for a certain period (maxAge) and that period has elapsed.
 */
export class SignatureExpiredError extends BadTimeSignatureError {
	/**
	 * Constructs a new `SignatureExpiredError` instance.
	 * @param {string} message - A descriptive error message explaining the
	 * signature expiration.
	 * @param {Uint8Array} payload - The original payload that caused the error.
	 * @param {Date} [dateSigned] - Optional date indicating when the payload was
	 * signed.
	 */
	constructor(message: string, payload: Uint8Array, dateSigned?: Date) {
		super(message, payload, dateSigned);
		this.name = 'SignatureExpiredError';
	}
}

/**
 * Error thrown when a signed header is found to be invalid during verification.
 * This may occur when a serializer uses a header alongside the signature that
 * does not match expected values.
 */
export class BadHeaderError extends BadSignatureError {
	/**
	 * The header data that failed validation.
	 */
	public header: Uint8Array;

	/**
	 * The original error that triggered this header validation failure.
	 */
	public originalError: $TsFixMe;

	/**
	 * Constructs a new `BadHeaderError` instance.
	 * @param {string} message - A descriptive error message explaining the header
	 * validation failure.
	 * @param {Uint8Array} payload - The original payload that caused the error.
	 * @param {Uint8Array} header - The header data that failed validation.
	 * @param {$TsFixMe} originalError - The original error that caused this
	 * header validation failure.
	 */
	constructor(message: string, payload: Uint8Array, header: Uint8Array, originalError: $TsFixMe) {
		super(message, payload);
		this.header = header;
		this.originalError = originalError;
		this.name = 'BadHeaderError';
	}
}

/**
 * Error thrown when a payload is determined to be invalid, potentially due to
 * issues with deserialization, or if an invalid signature allowed the payload
 * to be processed.
 */
export class BadPayloadError extends BadDataError {
	/**
	 * The original error that led to the payload being marked as invalid.
	 */
	public originalError: $TsFixMe;

	/**
	 * Constructs a new `BadPayloadError` instance.
	 * @param {string} message - A descriptive error message explaining the
	 * payload validation failure.
	 * @param {$TsFixMe} originalError - The original error that caused the
	 * payload to be considered invalid.
	 */
	constructor(message: string, originalError: $TsFixMe) {
		super(message);
		this.originalError = originalError;
		this.name = 'BadPayloadError';
	}
}
