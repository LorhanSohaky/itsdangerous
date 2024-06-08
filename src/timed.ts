import {concatUint8Arrays} from 'uint8array-extras';
import {base64Decode, base64Encode, bufferToInt, intToBuffer, wantBuffer} from './encoding.ts';
import {BadSignatureError, BadTimeSignatureError, SignatureExpiredError} from './errors.ts';
import {Serializer} from './serializer.ts';
import {Signer} from './signer.ts';
import type {$TsFixMe, StringBuffer} from './types.ts';

/**
 * Checks if a signer is an instance of TimestampSigner.
 * @param {Signer} signer - The signer to check.
 * @returns {boolean} - True if the signer is a TimestampSigner, false
 * otherwise.
 */
function isTimestampSigner(signer: Signer): signer is TimestampSigner {
	return 'getTimestamp' in signer && 'timestampToDate' in signer && 'unsign' in signer;
}

export class TimestampSigner extends Signer {
	/**
	 * Gets the current timestamp in seconds.
	 * @returns {number} - The current timestamp in seconds.
	 */
	public getTimestamp(): number {
		return Math.floor(Date.now() / 1000);
	}

	/**
	 * Converts a timestamp to a Date object.
	 * @param {number} timestamp - The timestamp to convert.
	 * @returns {Date} - The corresponding Date object.
	 * @throws {TypeError} - If the timestamp is invalid.
	 */
	public timestampToDate(timestamp: number): Date {
		const date = new Date(timestamp * 1000);
		if (Number.isNaN(date.getTime())) {
			throw new TypeError('Invalid timestamp');
		}
		return date;
	}

	/**
	 * Signs a value with a timestamp.
	 * @param {StringBuffer} value - The value to sign.
	 * @returns {Promise<Uint8Array>} - The signed value.
	 */
	public override async sign(value: StringBuffer): Promise<Uint8Array> {
		const bufferValue = wantBuffer(value);
		const timestamp = base64Encode(intToBuffer(this.getTimestamp()));
		const separator = this.separator;
		const newValue = concatUint8Arrays([bufferValue, separator, timestamp]);
		const signature = await this.getSignature(newValue);
		return concatUint8Arrays([newValue, separator, signature]);
	}

	/**
	 * Unsigns a signed value.
	 * @param {StringBuffer} signedValue - The signed value to unsign.
	 * @param {number} [maxAge] - The maximum allowed age of the signature in
	 * seconds.
	 * @returns {Promise<Uint8Array>} - The original value.
	 * @throws {BadSignatureError | BadTimeSignatureError | SignatureExpiredError}
	 * - If the signature is invalid, the timestamp is missing or malformed, or
	 *   the signature has expired.
	 */
	public override async unsign(signedValue: StringBuffer, maxAge?: number): Promise<Uint8Array>;

	/**
	 * Unsigns a signed value and optionally returns the timestamp.
	 * @param {StringBuffer} signedValue - The signed value to unsign.
	 * @param {number | undefined} maxAge - The maximum allowed age of the
	 * signature in seconds.
	 * @param {boolean} returnTimestamp - Whether to return the timestamp.
	 * @returns {Promise<Uint8Array | [Uint8Array, Date]>} - The original value
	 * and optionally the timestamp.
	 * @throws {BadSignatureError | BadTimeSignatureError | SignatureExpiredError}
	 * - If the signature is invalid, the timestamp is missing or malformed, or
	 *   the signature has expired.
	 */
	public override async unsign(
		signedValue: StringBuffer,
		maxAge: number | undefined,
		returnTimestamp: true,
	): Promise<[Uint8Array, Date]>;

	public override async unsign(
		signedValue: StringBuffer,
		maxAge?: number,
		returnTimestamp = false,
	): Promise<Uint8Array | [Uint8Array, Date]> {
		let result: Uint8Array;
		let sigError: BadSignatureError | undefined;

		try {
			result = await super.unsign(signedValue);
		} catch (error) {
			if (error instanceof BadSignatureError) {
				sigError = error;
				result = error.payload;
			} else {
				throw error;
			}
		}

		const separator = this.separator;
		const separatorIndex = result.lastIndexOf(separator[0]);

		if (separatorIndex === -1) {
			throw new BadTimeSignatureError('Missing timestamp', result);
		}

		const value = result.slice(0, separatorIndex);
		const timestampBuffer = result.slice(separatorIndex + separator.length);

		let timestampInt: number;
		try {
			timestampInt = Number(bufferToInt(base64Decode(timestampBuffer)));
		} catch {
			throw new BadTimeSignatureError('Malformed timestamp', value);
		}

		if (sigError) {
			try {
				const timestampDate = this.timestampToDate(timestampInt);
				throw new BadTimeSignatureError(sigError.message, value, timestampDate);
			} catch (error) {
				if (error instanceof TypeError) {
					throw new BadTimeSignatureError('Malformed timestamp', value);
				}
				throw error;
			}
		}

		if (maxAge != null) {
			const age = this.getTimestamp() - timestampInt;
			const timestampDate = this.timestampToDate(timestampInt);
			if (age > maxAge) {
				throw new SignatureExpiredError(`Signature age ${age} > ${maxAge} seconds`, value, timestampDate);
			}
			if (age < 0) {
				throw new SignatureExpiredError(`Signature age ${age} < 0 seconds`, value, timestampDate);
			}
		}

		if (returnTimestamp) {
			return [value, this.timestampToDate(timestampInt)];
		}

		return value;
	}

	/**
	 * Validates a signed value.
	 * @param {StringBuffer} signedValue - The signed value to validate.
	 * @param {number} [maxAge] - The maximum allowed age of the signature in
	 * seconds.
	 * @returns {Promise<boolean>} - True if the signature is valid, false
	 * otherwise.
	 */
	public override async validate(signedValue: StringBuffer, maxAge?: number): Promise<boolean> {
		try {
			await this.unsign(signedValue, maxAge);
			return true;
		} catch {
			return false;
		}
	}
}

export class TimedSerializer extends Serializer {
	public override signer = TimestampSigner;

	/**
	 * Parses a signed value.
	 * @param {StringBuffer} signed - The signed value to parse.
	 * @param {StringBuffer} [salt] - The salt to use for parsing.
	 * @param {number} [maxAge] - The maximum allowed age of the signature in
	 * seconds.
	 * @param {boolean} [returnTimestamp=false] - Whether to return the timestamp.
	 * @returns {Promise<$TsFixMe>} - The parsed payload.
	 * @throws {TypeError} - If the signer is not an instance of TimestampSigner.
	 */
	public override async parse(
		signed: StringBuffer,
		salt?: StringBuffer,
		maxAge?: number,
		returnTimestamp = false,
	): Promise<$TsFixMe> {
		const signedBuffer = wantBuffer(signed);
		const signer = this.makeSigner(salt ? wantBuffer(salt) : undefined);

		if (!isTimestampSigner(signer)) {
			throw new TypeError('Signer must be an instance of TimestampSigner');
		}

		const [base64d, timestamp] = await signer.unsign(signedBuffer, maxAge, true);
		const payload = this.parsePayload(base64d);

		if (returnTimestamp) {
			return [payload, timestamp];
		}

		return payload;
	}

	/**
	 * Unsafely parses a signed value.
	 * @param {StringBuffer} signed - The signed value to parse.
	 * @param {StringBuffer} [salt] - The salt to use for parsing.
	 * @param {number} [maxAge] - The maximum allowed age of the signature in
	 * seconds.
	 * @returns {Promise<[boolean, $TsFixMe]>} - A tuple containing a boolean
	 * indicating success and the parsed payload.
	 */
	public override async parseUnsafe(
		signed: StringBuffer,
		salt?: StringBuffer,
		maxAge?: number,
	): Promise<[boolean, $TsFixMe]> {
		try {
			return [true, await this.parse(signed, salt, maxAge)];
		} catch (error) {
			return this._handleParseUnsafeError(error);
		}
	}
}
