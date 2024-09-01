import {concatUint8Arrays} from 'uint8array-extras';
import {base64Decode, base64Encode, bufferToInt, intToBuffer, wantBuffer} from './encoding.ts';
import {BadSignatureError, BadTimeSignatureError, SignatureExpiredError} from './errors.ts';
import {Serializer} from './serializer.ts';
import {Signer} from './signer.ts';
import type {$TsFixMe, StringBuffer} from './types.ts';

/**
 * Determines if a given signer is an instance of `TimestampSigner`. This is
 * useful for ensuring that a signer has timestamp-related capabilities.
 * @param {Signer} signer - The signer instance to check.
 * @returns {boolean} - `true` if the signer is an instance of
 * `TimestampSigner`, otherwise `false`.
 */
function isTimestampSigner(signer: Signer): signer is TimestampSigner {
	return 'getTimestamp' in signer && 'timestampToDate' in signer && 'unsign' in signer;
}

/**
 * The `TimestampSigner` class extends the functionality of the `Signer` class
 * by including a timestamp when signing data. This allows signatures to have an
 * expiration time, after which they are considered invalid. The `unsign` method
 * can throw `SignatureExpiredError` if the signature is expired.
 */
export class TimestampSigner extends Signer {
	/**
	 * Retrieves the current timestamp in seconds since the UNIX epoch.
	 * @returns {number} - The current timestamp in seconds.
	 */
	public getTimestamp(): number {
		return Math.floor(Date.now() / 1000);
	}

	/**
	 * Converts a timestamp (in seconds) to a JavaScript `Date` object.
	 * @param {number} timestamp - The timestamp in seconds to convert.
	 * @returns {Date} - The corresponding `Date` object.
	 * @throws {TypeError} - If the provided timestamp is invalid.
	 */
	public timestampToDate(timestamp: number): Date {
		const date = new Date(timestamp * 1000);
		if (Number.isNaN(date.getTime())) {
			throw new TypeError('Invalid timestamp');
		}
		return date;
	}

	/**
	 * Signs a given value along with the current timestamp.
	 * @param {StringBuffer} value - The value to sign.
	 * @returns {Promise<Uint8Array>} - The signed value as a `Uint8Array`.
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
	 * Verifies and extracts the original value from a signed value. If a `maxAge`
	 * is provided, the method will check if the signature is older than the
	 * allowed age.
	 * @param {StringBuffer} signedValue - The signed value to verify and extract.
	 * @param {number} [maxAge] - The maximum allowed age of the signature in
	 * seconds.
	 * @returns {Promise<Uint8Array>} - The original unsigned value.
	 * @throws {BadSignatureError | BadTimeSignatureError | SignatureExpiredError}
	 * - If the signature is invalid, the timestamp is missing or malformed, or
	 *   the signature has expired.
	 */
	public override async unsign(signedValue: StringBuffer, maxAge?: number): Promise<Uint8Array>;

	/**
	 * Verifies and extracts the original value from a signed value, optionally
	 * returning the timestamp.
	 * @param {StringBuffer} signedValue - The signed value to verify and extract.
	 * @param {number | undefined} maxAge - The maximum allowed age of the
	 * signature in seconds.
	 * @param {boolean} returnTimestamp - Whether to return the timestamp along
	 * with the original value.
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
	 * Validates a signed value by verifying its signature and ensuring it has not
	 * expired.
	 * @param {StringBuffer} signedValue - The signed value to validate.
	 * @param {number} [maxAge] - The maximum allowed age of the signature in
	 * seconds.
	 * @returns {Promise<boolean>} - `true` if the signature is valid and within
	 * the allowed age, otherwise `false`.
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

/**
 * The `TimedSerializer` class extends the `Serializer` class, using a
 * `TimestampSigner` to sign values with a timestamp. This allows for the
 * creation of time-sensitive signatures that can expire.
 */
export class TimedSerializer extends Serializer {
	public override signer = TimestampSigner;

	/**
	 * Parses a signed value, verifying its signature and optionally checking its
	 * age. If `returnTimestamp` is true, the method also returns the timestamp
	 * associated with the signature.
	 * @param {StringBuffer} signed - The signed value to parse.
	 * @param {StringBuffer} [salt] - The salt to use for parsing.
	 * @param {number} [maxAge] - The maximum allowed age of the signature in
	 * seconds.
	 * @param {boolean} [returnTimestamp=false] - Whether to return the timestamp
	 * along with the parsed value.
	 * @returns {Promise<$TsFixMe>} - The parsed payload, and optionally the
	 * timestamp.
	 * @throws {TypeError} - If the signer is not an instance of
	 * `TimestampSigner`.
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
	 * Unsafely parses a signed value without verifying the signature. This method
	 * is intended for debugging and should be used with caution, as it does not
	 * guarantee the integrity of the data.
	 * @param {StringBuffer} signed - The signed value to parse.
	 * @param {StringBuffer} [salt] - The salt to use for parsing.
	 * @param {number} [maxAge] - The maximum allowed age of the signature in
	 * seconds.
	 * @returns {Promise<[boolean, $TsFixMe]>} - A tuple where the first element
	 * is `true` if the parse succeeded, and the second element is the parsed
	 * payload.
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
