import {wantBuffer} from './encoding.ts';
import {BadPayloadError, BadSignatureError} from './errors.ts';
import {Signer, type SignerOptions, makeKeysList} from './signer.ts';
import type {$TsFixMe, SecretKey, StringBuffer} from './types.ts';

export type DefaultSerializer = {
	stringify(value: $TsFixMe): string;
	parse(value: $TsFixMe): $TsFixMe;
};

/**
 * Checks if the provided serializer is a text-based serializer.
 * @param {DefaultSerializer} serializer - The serializer to check.
 * @returns {boolean} - Whether the serializer is text-based.
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
 * A serializer wraps a `Signer` to enable serializing and securely signing data
 * other than bytes. It can unsign to verify that the data hasn't been changed.
 *
 * The serializer provides `stringify` and `parse`, similar to the `JSON`
 * object, and by default uses `JSON` internally to serialize the data to bytes.
 *
 * The secret key should be a random string of bytes and should not be saved to
 * code or version control. Different salts should be used to distinguish
 * signing in different contexts.
 */
export class Serializer {
	/**
	 * The default serialization module to use to serialize data to a string
	 * internally. The default is `JSON`, but can be changed to any object that
	 * provides `stringify` and `parse` methods.
	 */
	public defaultSerializer: DefaultSerializer = JSON;

	/**
	 * The default `Signer` class to instantiate when signing data. The default is
	 * `Signer`.
	 */
	public defaultSigner = Signer;

	/**
	 * The list of secret keys to try for verifying signatures, from oldest to
	 * newest. The newest (last) key is used for signing.
	 *
	 * This allows a key rotation system to keep a list of allowed keys and remove
	 * expired ones.
	 */
	public secretKeys: Uint8Array[];
	public salt: Uint8Array;
	public serializer: DefaultSerializer;
	public isTextSerializer: boolean;
	public signer: typeof Signer;
	public signerOpts: Partial<SignerOptions>;

	/**
	 * @param {SerializerOptions} options - Options to configure the serializer.
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
	 * Parses the encoded object. Throws `BadPayloadError` if the payload is not
	 * valid. The `serializer` parameter can be used to override the serializer
	 * stored on the class. The encoded `payload` should always be a Uint8Array.
	 * @param {Uint8Array} payload - The payload to parse.
	 * @param {DefaultSerializer} [serializer] - Optional serializer to use.
	 * @returns {$TsFixMe} - The parsed object.
	 * @throws {BadPayloadError} - If the payload cannot be parsed.
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
	 * Stringifies the encoded object. The return value is always Uint8Array. If
	 * the internal serializer returns text, the value will be encoded as UTF-8.
	 * @param {$TsFixMe} object - The object to stringify.
	 * @returns {Uint8Array} - The stringified object as a Uint8Array.
	 */
	public stringifyPayload(object: $TsFixMe): Uint8Array {
		const json = this.serializer.stringify(object);
		const isText = isTextSerializer(this.serializer);
		return isText ? new TextEncoder().encode(json) : wantBuffer(json);
	}

	/**
	 * Creates a new instance of the signer to be used. The default implementation
	 * uses the `Signer` base class.
	 * @param {StringBuffer} [salt] - Optional salt to use for the signer.
	 * @returns {Signer} - A new signer instance.
	 */
	public makeSigner(salt?: StringBuffer): Signer {
		return new this.signer({
			secretKey: this.secretKeys,
			salt: salt ?? this.salt,
			...this.signerOpts,
		});
	}

	/**
	 * Returns a signed string serialized with the internal serializer. The return
	 * value can be either a byte or Unicode string depending on the format of the
	 * internal serializer.
	 * @param {$TsFixMe} object - The object to stringify and sign.
	 * @param {StringBuffer} [salt] - Optional salt to use for signing.
	 * @returns {Promise<string>} - The signed string.
	 */
	public async stringify(object: $TsFixMe, salt?: StringBuffer): Promise<string> {
		const payload = this.stringifyPayload(object);
		const signer = this.makeSigner(salt);
		const signed = await signer.sign(payload);
		return new TextDecoder().decode(signed);
	}

	/**
	 * Reverse of `stringify`. Throws `BadSignatureError` if the signature
	 * validation fails.
	 * @param {StringBuffer} signed - The signed string to parse.
	 * @param {StringBuffer} [salt] - Optional salt to use for parsing.
	 * @returns {Promise<$TsFixMe>} - The parsed object.
	 * @throws {BadSignatureError} - If the signature validation fails.
	 */
	public async parse(signed: StringBuffer, salt?: StringBuffer): Promise<$TsFixMe> {
		const buffer = wantBuffer(signed);
		const payload = await this.makeSigner(salt).unsign(buffer);
		return this.parsePayload(payload);
	}

	/**
	 * Like `parse` but without verifying the signature. This is potentially very
	 * dangerous to use depending on how your serializer works. The return value
	 * is `(signatureValid, payload)` instead of just the payload. The first item
	 * will be a boolean that indicates if the signature is valid. This function
	 * never fails.
	 *
	 * Use it for debugging only and if you know that your serializer module is
	 * not exploitable (for example, do not use it with a pickle serializer).
	 * @param {StringBuffer} signed - The signed string to parse.
	 * @param {StringBuffer} [salt] - Optional salt to use for parsing.
	 * @returns {Promise<[boolean, $TsFixMe]>} - A tuple where the first item
	 * indicates if the signature is valid and the second item is the parsed
	 * payload.
	 */
	public async parseUnsafe(signed: StringBuffer, salt?: StringBuffer): Promise<[boolean, $TsFixMe]> {
		try {
			return [true, await this.parse(signed, salt)];
		} catch (error) {
			return this._handleParseUnsafeError(error);
		}
	}

	/**
	 * Handles errors for the `parseUnsafe` method.
	 * @param {unknown} error - The error to handle.
	 * @returns {[boolean, $TsFixMe]} - A tuple where the first item indicates if
	 * the signature is valid and the second item is `null`.
	 */
	protected _handleParseUnsafeError(error: unknown): [boolean, $TsFixMe] {
		if (error instanceof BadSignatureError || error instanceof BadPayloadError) {
			return [false, null];
		}
		throw error;
	}
}
