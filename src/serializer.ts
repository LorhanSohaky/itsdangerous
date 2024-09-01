import {wantBuffer} from './encoding.ts';
import {BadPayloadError, BadSignatureError} from './errors.ts';
import {Signer, type SignerOptions, makeKeysList} from './signer.ts';
import type {$TsFixMe, SecretKey, StringBuffer} from './types.ts';

/**
 * A serializer interface that defines methods for serializing and deserializing
 * data. This is typically used to convert JavaScript objects to strings and
 * vice versa.
 */
export type DefaultSerializer = {
	/**
	 * Converts a JavaScript value to a JSON string.
	 * @param value - A JavaScript value, usually an object or array, to be
	 * serialized.
	 * @returns {string} - The JSON string representation of the input value.
	 */
	stringify(value: $TsFixMe): string;

	/**
	 * Parses a JSON string into a JavaScript object.
	 * @param value - A JSON string to be parsed.
	 * @returns {$TsFixMe} - The JavaScript object resulting from the parsed JSON
	 * string.
	 */
	parse(value: $TsFixMe): $TsFixMe;
};

/**
 * Determines if the provided serializer is text-based, meaning it works with
 * text strings.
 * @param {DefaultSerializer} serializer - The serializer to evaluate.
 * @returns {boolean} - `true` if the serializer is text-based, otherwise
 * `false`.
 */
function isTextSerializer(serializer: DefaultSerializer): boolean {
	return typeof serializer.stringify({}) === 'string';
}

export type SerializerOptions = {
	secretKey: SecretKey;
	salt?: StringBuffer;
	serializer?: DefaultSerializer;
	signer?: typeof Signer;
	signerOpts?: Partial<SignerOptions>;
};

/**
 * The `Serializer` class provides methods to serialize and securely sign data,
 * as well as verify and deserialize signed data. It uses a `Signer` to sign
 * data and can work with custom serialization formats.
 *
 * By default, it uses the JSON format for serialization, but this can be
 * overridden with a custom serializer. The `Serializer` ensures that signed
 * data can be verified to detect tampering.
 */
export class Serializer {
	/**
	 * The default serializer used to convert data to and from strings. Defaults
	 * to the `JSON` object.
	 */
	public defaultSerializer: DefaultSerializer = JSON;

	/**
	 * The default `Signer` class used for signing and verifying data. Defaults to
	 * the `Signer` class.
	 */
	public defaultSigner = Signer;

	/**
	 * A list of secret keys used for verifying signatures. The most recent key
	 * (last in the list) is used for signing. This supports key rotation by
	 * allowing old keys to verify existing signatures.
	 */
	public secretKeys: Uint8Array[];
	public salt: Uint8Array;
	public serializer: DefaultSerializer;
	public isTextSerializer: boolean;
	public signer: typeof Signer;
	public signerOpts: Partial<SignerOptions>;

	/**
	 * Creates an instance of the `Serializer` class with the specified options.
	 * @param {SerializerOptions} options - Configuration options for the
	 * serializer.
	 * @param {SecretKey} options.secretKey - The primary secret key used for
	 * signing and verification.
	 * @param {StringBuffer} [options.salt] - Optional salt value used in signing.
	 * Defaults to 'itsdangerous'.
	 * @param {DefaultSerializer} [options.serializer] - Optional custom
	 * serializer. Defaults to JSON.
	 * @param {typeof Signer} [options.signer] - Optional custom `Signer` class.
	 * Defaults to the `Signer` class.
	 * @param {Partial<SignerOptions>} [options.signerOpts] - Optional additional
	 * options for the `Signer`.
	 */
	public constructor({
		secretKey,
		salt = new TextEncoder().encode('itsdangerous'),
		serializer,
		signer,
		signerOpts,
	}: SerializerOptions) {
		this.secretKeys = makeKeysList(secretKey);
		this.salt = wantBuffer(salt);
		this.serializer = serializer ?? this.defaultSerializer;
		this.isTextSerializer = isTextSerializer(this.serializer);
		this.signer = signer ?? this.defaultSigner;
		this.signerOpts = signerOpts ?? {};
	}

	/**
	 * Parses an encoded payload. Throws a `BadPayloadError` if the payload is
	 * invalid or cannot be parsed.
	 * @param {Uint8Array} payload - The encoded payload to parse, expected to be
	 * a `Uint8Array`.
	 * @param {DefaultSerializer} [serializer] - Optional serializer to use
	 * instead of the class's default serializer.
	 * @returns {$TsFixMe} - The parsed JavaScript object.
	 * @throws {BadPayloadError} - If the payload is invalid or cannot be
	 * deserialized.
	 */
	public parsePayload(payload: Uint8Array, serializer?: DefaultSerializer): $TsFixMe {
		const useSerializer = serializer ?? this.serializer;
		const isText = isTextSerializer(useSerializer);
		try {
			return isText ? useSerializer.parse(new TextDecoder().decode(payload)) : useSerializer.parse(payload);
		} catch (error) {
			throw new BadPayloadError('Failed to deserialize the data due to an error.', error);
		}
	}

	/**
	 * Serializes a JavaScript object into a `Uint8Array`. If the serializer
	 * produces text, it will be UTF-8 encoded.
	 * @param {$TsFixMe} object - The object to serialize.
	 * @returns {Uint8Array} - The serialized object as a `Uint8Array`.
	 */
	public stringifyPayload(object: $TsFixMe): Uint8Array {
		const json = this.serializer.stringify(object);
		const isText = isTextSerializer(this.serializer);
		return isText ? new TextEncoder().encode(json) : wantBuffer(json);
	}

	/**
	 * Creates a new `Signer` instance configured with the current options.
	 * @param {StringBuffer} [salt] - Optional salt value to use for the `Signer`.
	 * @returns {Signer} - A new `Signer` instance.
	 */
	public makeSigner(salt?: StringBuffer): Signer {
		return new this.signer({
			secretKey: this.secretKeys,
			salt: salt ?? this.salt,
			...this.signerOpts,
		});
	}

	/**
	 * Serializes and signs a JavaScript object, returning the signed string.
	 * @param {$TsFixMe} object - The object to serialize and sign.
	 * @param {StringBuffer} [salt] - Optional salt value to use for signing.
	 * @returns {Promise<string>} - The signed string, encoded in UTF-8.
	 */
	public async stringify(object: $TsFixMe, salt?: StringBuffer): Promise<string> {
		const payload = this.stringifyPayload(object);
		const signer = this.makeSigner(salt);
		const signed = await signer.sign(payload);
		return new TextDecoder().decode(signed);
	}

	/**
	 * Verifies and deserializes a signed string. Throws `BadSignatureError` if
	 * the signature is invalid.
	 * @param {StringBuffer} signed - The signed string to verify and parse.
	 * @param {StringBuffer} [salt] - Optional salt value to use for verification.
	 * @returns {Promise<$TsFixMe>} - The deserialized JavaScript object.
	 * @throws {BadSignatureError} - If the signature validation fails.
	 */
	public async parse(signed: StringBuffer, salt?: StringBuffer): Promise<$TsFixMe> {
		const buffer = wantBuffer(signed);
		const payload = await this.makeSigner(salt).unsign(buffer);
		return this.parsePayload(payload);
	}

	/**
	 * Parses a signed string without verifying the signature. Returns a tuple
	 * where the first element indicates if the signature was valid and the second
	 * element is the parsed payload. This method should be used with caution as
	 * it bypasses signature validation.
	 * @param {StringBuffer} signed - The signed string to parse.
	 * @param {StringBuffer} [salt] - Optional salt value to use for parsing.
	 * @returns {Promise<[boolean, $TsFixMe]>} - A tuple where the first element
	 * is a boolean indicating whether the signature is valid, and the second
	 * element is the parsed object.
	 */
	public async parseUnsafe(signed: StringBuffer, salt?: StringBuffer): Promise<[boolean, $TsFixMe]> {
		try {
			return [true, await this.parse(signed, salt)];
		} catch (error) {
			return this._handleParseUnsafeError(error);
		}
	}

	/**
	 * Handles errors encountered in the `parseUnsafe` method, distinguishing
	 * between known errors and others.
	 * @param {unknown} error - The error encountered during parsing.
	 * @returns {[boolean, $TsFixMe]} - A tuple where the first element is
	 * `false`, indicating the signature was invalid, and the second element is
	 * `null`.
	 * @throws {unknown} - Rethrows the error if it is not a known error type.
	 */
	protected _handleParseUnsafeError(error: unknown): [boolean, $TsFixMe] {
		if (error instanceof BadSignatureError || error instanceof BadPayloadError) {
			return [false, null];
		}
		throw error;
	}
}
