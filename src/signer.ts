import {areUint8ArraysEqual, concatUint8Arrays} from 'uint8array-extras';
import {BASE64_ALPHABET, base64Decode, base64Encode, wantBuffer} from './encoding.ts';
import {BadSignatureError} from './errors.ts';
import type {SecretKey, StringBuffer} from './types.ts';

/**
 * Generates an HMAC digest for the given data using the specified hashing
 * algorithm and key.
 * @param {string} algo - The name of the hashing algorithm to use (e.g.,
 * 'SHA-256').
 * @param {Uint8Array} key - The key used for the HMAC.
 * @param {Uint8Array} data - The data to be signed.
 * @returns {Promise<Uint8Array>} - A promise that resolves to the generated
 * HMAC digest as a `Uint8Array`.
 */
async function hmacDigest(algo: string, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
	const cryptoKey = await crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: {name: algo}}, false, ['sign']);
	const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
	return new Uint8Array(signature);
}

/**
 * Generates a hash digest for the given data using the specified hashing
 * algorithm.
 * @param {string} algo - The name of the hashing algorithm to use (e.g.,
 * 'SHA-256').
 * @param {Uint8Array} data - The data to be hashed.
 * @returns {Promise<Uint8Array>} - A promise that resolves to the generated
 * hash digest as a `Uint8Array`.
 */
async function hashDigest(algo: string, data: Uint8Array): Promise<Uint8Array> {
	const hash = await crypto.subtle.digest(algo, data);
	return new Uint8Array(hash);
}

/**
 * A base class for implementing signature algorithms. Subclasses must implement
 * the `getSignature` method.
 */
export class SigningAlgorithm {
	public digestMethod?: string;

	/**
	 * Generates a signature for the provided key and value. Subclasses should
	 * override this method to provide specific signature generation logic.
	 * @param {Uint8Array} _key - The key used for signing.
	 * @param {Uint8Array} _value - The value to be signed.
	 * @returns {Promise<Uint8Array>} - A promise that resolves to the generated
	 * signature as a `Uint8Array`.
	 * @throws {Error} - Always throws an error indicating the method is not
	 * implemented.
	 */
	public async getSignature(_key: Uint8Array, _value: Uint8Array): Promise<Uint8Array> {
		throw new Error('Not implemented');
	}

	/**
	 * Verifies the provided signature against the given key and value.
	 * @param {Uint8Array} key - The key used for verification.
	 * @param {Uint8Array} value - The value that was signed.
	 * @param {Uint8Array} sig - The signature to verify.
	 * @returns {Promise<boolean>} - A promise that resolves to `true` if the
	 * signature is valid, otherwise `false`.
	 */
	public async verifySignature(key: Uint8Array, value: Uint8Array, sig: Uint8Array): Promise<boolean> {
		try {
			const expectedSig = await this.getSignature(key, value);
			return areUint8ArraysEqual(sig, expectedSig);
		} catch {
			return false;
		}
	}
}

/**
 * A signature algorithm that does not perform any signing and always returns an
 * empty signature.
 */
export class NoneAlgorithm extends SigningAlgorithm {
	/**
	 * Returns an empty signature.
	 * @returns {Promise<Uint8Array>} - A promise that resolves to an empty
	 * `Uint8Array`.
	 */
	public override async getSignature(_key: Uint8Array, _value: Uint8Array): Promise<Uint8Array> {
		return new Uint8Array([]);
	}
}

/**
 * A signature algorithm that generates signatures using HMAC (Hash-based
 * Message Authentication Code).
 */
export class HMACAlgorithm extends SigningAlgorithm {
	public override digestMethod: string;
	public defaultDigestMethod = 'SHA-1' as const;

	/**
	 * Creates an instance of `HMACAlgorithm` with an optional digest method.
	 * @param {string} [digestMethod] - The digest method to use (e.g.,
	 * 'SHA-256'). Defaults to 'SHA-1'.
	 */
	public constructor(digestMethod?: string) {
		super();
		this.digestMethod = digestMethod ?? this.defaultDigestMethod;
	}

	/**
	 * Generates an HMAC signature for the provided key and value.
	 * @param {Uint8Array} key - The key used for HMAC.
	 * @param {Uint8Array} value - The value to be signed.
	 * @returns {Promise<Uint8Array>} - A promise that resolves to the HMAC
	 * signature as a `Uint8Array`.
	 */
	public override async getSignature(key: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
		return await hmacDigest(this.digestMethod, key, value);
	}
}

/**
 * Converts a secret key into an array of `Uint8Array` objects.
 * @param {SecretKey} secretKey - The secret key to convert. It can be a string,
 * `Uint8Array`, or an array of such values.
 * @returns {Uint8Array[]} - An array of `Uint8Array` representing the secret
 * key(s).
 */
export function makeKeysList(secretKey: SecretKey): Uint8Array[] {
	if (typeof secretKey === 'string' || secretKey instanceof Uint8Array) {
		return [wantBuffer(secretKey)];
	}
	return [...secretKey].map((x) => wantBuffer(x));
}

/**
 * Enum representing the available key derivation methods.
 */
export enum KeyDerivation {
	Concat = 'concat',
	DjangoConcat = 'django-concat',
	HMAC = 'hmac',
	None = 'none',
}

/**
 * Defines the options that can be provided to a `Signer` instance.
 */
export type SignerOptions = {
	secretKey: SecretKey;
	salt?: StringBuffer;
	separator?: StringBuffer;
	keyDerivation?: KeyDerivation;
	digestMethod?: string;
	algorithm?: SigningAlgorithm;
};

/**
 * The `Signer` class securely signs data and verifies that it hasn't been
 * tampered with by checking the signature. It supports various signing
 * algorithms and key derivation methods.
 */
export class Signer {
	public defaultDigestMethod = 'SHA-1' as const;
	public defaultKeyDerivation = KeyDerivation.DjangoConcat;
	public secretKeys: Uint8Array[];
	public separator: Uint8Array;
	public salt: Uint8Array;
	public keyDerivation: KeyDerivation;
	public digestMethod: string;
	public algorithm: SigningAlgorithm;

	/**
	 * Creates an instance of `Signer` with the provided options.
	 * @param {SignerOptions} options - Configuration options for the signer.
	 * @param {SecretKey} options.secretKey - The secret key(s) used for signing
	 * and verification. Supports key rotation by using a list of keys.
	 * @param {StringBuffer} [options.salt] - An additional salt value to combine
	 * with the secret key. Defaults to `"itsdangerous.Signer"`.
	 * @param {StringBuffer} [options.separator] - The separator between the value
	 * and the signature. Defaults to `"."`.
	 * @param {KeyDerivation} [options.keyDerivation] - The method for deriving
	 * the signing key. Defaults to `"django-concat"`.
	 * @param {string} [options.digestMethod] - The hash function to use for HMAC
	 * signatures. Defaults to `"SHA-1"`.
	 * @param {SigningAlgorithm} [options.algorithm] - The signing algorithm to
	 * use. Defaults to `HMACAlgorithm`.
	 */
	public constructor({
		secretKey,
		salt = wantBuffer('itsdangerous.Signer'),
		separator = wantBuffer('.'),
		keyDerivation,
		digestMethod,
		algorithm,
	}: SignerOptions) {
		this.secretKeys = makeKeysList(secretKey);
		this.separator = wantBuffer(separator);

		if (BASE64_ALPHABET.includes(new TextDecoder().decode(this.separator))) {
			throw new TypeError(
				"The given separator cannot be used because it may be contained in the signature itself. ASCII letters, digits, and '-_=' must not be used.",
			);
		}

		this.salt = wantBuffer(salt);
		this.keyDerivation = keyDerivation ?? this.defaultKeyDerivation;
		this.digestMethod = digestMethod ?? this.defaultDigestMethod;
		this.algorithm = algorithm ?? new HMACAlgorithm(digestMethod);
	}

	/**
	 * Derives a key from the secret key using the specified key derivation
	 * method.
	 * @param {StringBuffer} [secretKey] - The secret key to derive the key from.
	 * If not provided, the last key in the `secretKeys` list is used.
	 * @returns {Promise<Uint8Array>} - A promise that resolves to the derived key
	 * as a `Uint8Array`.
	 * @throws {TypeError} - If an invalid key derivation method is provided.
	 */
	public async deriveKey(secretKey?: StringBuffer): Promise<Uint8Array> {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const derivedSecretKey = secretKey == null ? this.secretKeys.at(-1)! : wantBuffer(secretKey);

		switch (this.keyDerivation) {
			case KeyDerivation.Concat:
				return await hashDigest(this.digestMethod, concatUint8Arrays([this.salt, derivedSecretKey]));
			case KeyDerivation.DjangoConcat:
				return await hashDigest(
					this.digestMethod,
					concatUint8Arrays([this.salt, wantBuffer('signer'), derivedSecretKey]),
				);
			case KeyDerivation.HMAC:
				return await hmacDigest(this.digestMethod, derivedSecretKey, this.salt);
			case KeyDerivation.None:
				return derivedSecretKey;
			default:
				throw new TypeError('Invalid key derivation method');
		}
	}

	/**
	 * Generates a signature for the provided value using the derived key.
	 * @param {StringBuffer} value - The value to be signed.
	 * @returns {Promise<Uint8Array>} - A promise that resolves to the generated
	 * signature as a `Uint8Array`.
	 */
	public async getSignature(value: StringBuffer): Promise<Uint8Array> {
		const key = await this.deriveKey();
		const signature = await this.algorithm.getSignature(key, wantBuffer(value));
		return base64Encode(signature);
	}

	/**
	 * Signs the provided value by appending a signature to it.
	 * @param {StringBuffer} value - The value to be signed.
	 * @returns {Promise<Uint8Array>} - A promise that resolves to the signed
	 * value as a `Uint8Array`.
	 */
	public async sign(value: StringBuffer): Promise<Uint8Array> {
		const bufferValue = wantBuffer(value);
		const signature = await this.getSignature(value);
		return concatUint8Arrays([bufferValue, this.separator, signature]);
	}

	/**
	 * Verifies if the provided signature is valid for the given value.
	 * @param {StringBuffer} value - The value to verify.
	 * @param {StringBuffer} sig - The signature to verify against.
	 * @returns {Promise<boolean>} - A promise that resolves to `true` if the
	 * signature is valid, otherwise `false`.
	 */
	public async verifySignature(value: StringBuffer, sig: StringBuffer): Promise<boolean> {
		let decodedSig: Uint8Array;
		try {
			decodedSig = base64Decode(sig);
		} catch {
			return false;
		}

		const bufferValue = wantBuffer(value);

		for (const secretKey of this.secretKeys) {
			const key = await this.deriveKey(secretKey);
			if (await this.algorithm.verifySignature(key, bufferValue, decodedSig)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Unsigns the signed value to retrieve the original value, verifying the
	 * signature in the process.
	 * @param {StringBuffer} signedValue - The signed value to unsign.
	 * @returns {Promise<Uint8Array>} - A promise that resolves to the original
	 * value as a `Uint8Array`.
	 * @throws {BadSignatureError} - If the signature is invalid or the separator
	 * is not found.
	 */
	public async unsign(signedValue: StringBuffer): Promise<Uint8Array> {
		const signedBuffer = wantBuffer(signedValue);
		const separatorIndex = signedBuffer.lastIndexOf(this.separator[0]);

		if (separatorIndex === -1) {
			throw new BadSignatureError(
				`Separator '${new TextDecoder().decode(this.separator)}' not found in value`,
				signedBuffer,
			);
		}

		const value = signedBuffer.slice(0, separatorIndex);
		const sig = signedBuffer.slice(separatorIndex + this.separator.length);

		if (!(await this.verifySignature(value, sig))) {
			throw new BadSignatureError('Invalid signature for the provided value.', value);
		}

		return value;
	}

	/**
	 * Validates a signed value by verifying its signature.
	 * @param {StringBuffer} signedValue - The signed value to validate.
	 * @returns {Promise<boolean>} - A promise that resolves to `true` if the
	 * signed value is valid, otherwise `false`.
	 */
	public async validate(signedValue: StringBuffer): Promise<boolean> {
		try {
			await this.unsign(signedValue);
			return true;
		} catch (error) {
			if (error instanceof BadSignatureError) {
				return false;
			}
			throw error;
		}
	}
}
