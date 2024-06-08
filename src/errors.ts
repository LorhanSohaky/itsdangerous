import type {$TsFixMe} from './types.ts';

/**
 * Base class for errors related to encountering bad data. This class is the
 * foundation for all other errors defined in this module.
 */
export class BadDataError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BadDataError';
	}
}

/**
 * Error thrown when a data signature does not match the expected value. This
 * error allows access to the original payload which may still be of interest,
 * even if it has been tampered with.
 */
export class BadSignatureError extends BadDataError {
	public payload: Uint8Array;

	constructor(message: string, payload: Uint8Array) {
		super(message);
		this.payload = payload;
		this.name = 'BadSignatureError';
	}
}

/**
 * Error thrown when a time-based signature is invalid. Extends from
 * BadSignatureError and provides additional context like the signing date.
 */
export class BadTimeSignatureError extends BadSignatureError {
	public dateSigned?: Date;

	constructor(message: string, payload: Uint8Array, dateSigned?: Date) {
		super(message, payload);
		this.dateSigned = dateSigned;
	}
}

/**
 * Error thrown when a signature has expired. This is specific for cases where a
 * signature is valid only for a certain duration (maxAge).
 */
export class SignatureExpiredError extends BadTimeSignatureError {
	constructor(message: string, payload: Uint8Array, dateSigned?: Date) {
		super(message, payload, dateSigned);
		this.name = 'SignatureExpiredError';
	}
}

/**
 * Error thrown when a signed header is found to be invalid. This can occur if
 * serializers use a header alongside the signature that fails validation.
 */
export class BadHeaderError extends BadSignatureError {
	public header: Uint8Array;
	public originalError: $TsFixMe;

	constructor(message: string, payload: Uint8Array, header: Uint8Array, originalError: $TsFixMe) {
		super(message, payload);
		this.header = header;
		this.originalError = originalError;
		this.name = 'BadHeaderError';
	}
}

/**
 * Error thrown when a payload is invalid. This might occur if the payload is
 * processed despite having an invalid signature, or if there is a mismatch in
 * serialization and deserialization processes.
 */
export class BadPayloadError extends BadDataError {
	public originalError: $TsFixMe;

	constructor(message: string, originalError: $TsFixMe) {
		super(message);
		this.originalError = originalError;
		this.name = 'BadPayloadError';
	}
}
