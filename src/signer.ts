import {areUint8ArraysEqual, concatUint8Arrays} from 'uint8array-extras';
import {BASE64_ALPHABET, base64Decode, base64Encode, wantBuffer} from './encoding.ts';
import {BadSignatureError} from './errors.ts';
import type {SecretKey, StringBuffer} from './types.ts';

/**
 * Generates an HMAC digest.
 * @param {string} algo - The hashing algorithm to use.
 * @param {Uint8Array} key - The key for HMAC.
 * @param {Uint8Array} data - The data to sign.
 * @returns {Promise<Uint8Array>} The generated HMAC digest.
 */
async function hmacDigest(algo: string, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
	const cryptoKey = await crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: {name: algo}}, false, ['sign']);
	const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
	return new Uint8Array(signature);
}

/**
 * Generates a hash digest.
 * @param {string} algo - The hashing algorithm to use.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Promise<Uint8Array>} The generated hash digest.
 */
async function hashDigest(algo: string, data: Uint8Array): Promise<Uint8Array> {
	const hash = await crypto.subtle.digest(algo, data);
	return new Uint8Array(hash);
}

export class SigningAlgorithm {
	public digestMethod?: string;

	/**
	 * Gets the signature for the provided key and value.
	 * @param {Uint8Array} _key - The key for signing.
	 * @param {Uint8Array} _value - The value to sign.
	 * @returns {Promise<Uint8Array>} The signature.
	 * @throws {Error} Not implemented.
	 */
	public async getSignature(_key: Uint8Array, _value: Uint8Array): Promise<Uint8Array> {
		throw new Error('Not implemented');
	}

	/**
	 * Verifies the provided signature.
	 * @param {Uint8Array} key - The key for verification.
	 * @param {Uint8Array} value - The value to verify.
	 * @param {Uint8Array} sig - The signature to verify against.
	 * @returns {Promise<boolean>} Whether the signature is valid.
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

export class NoneAlgorithm extends SigningAlgorithm {
	/**
	 * Gets an empty signature.
	 * @returns {Promise<Uint8Array>} An empty Uint8Array.
	 */
	public override async getSignature(_key: Uint8Array, _value: Uint8Array): Promise<Uint8Array> {
		return new Uint8Array([]);
	}
}

export class HMACAlgorithm extends SigningAlgorithm {
	public override digestMethod: string;
	public defaultDigestMethod = 'SHA-1';

	/**
	 * Creates an instance of HMACAlgorithm.
	 * @param {string} [digestMethod] - The digest method to use.
	 */
	public constructor(digestMethod?: string) {
		super();
		this.digestMethod = digestMethod ?? this.defaultDigestMethod;
	}

	/**
	 * Gets the HMAC signature.
	 * @param {Uint8Array} key - The key for HMAC.
	 * @param {Uint8Array} value - The value to sign.
	 * @returns {Promise<Uint8Array>} The HMAC signature.
	 */
	public override async getSignature(key: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
		return await hmacDigest(this.digestMethod, key, value);
	}
}

/**
 * Converts the provided secret key into a list of Uint8Array.
 * @param {SecretKey} secretKey - The secret key to convert.
 * @returns {Uint8Array[]} The list of Uint8Array.
 */
export function makeKeysList(secretKey: SecretKey): Uint8Array[] {
	if (typeof secretKey === 'string' || secretKey instanceof Uint8Array) {
		return [wantBuffer(secretKey)];
	}
	return [...secretKey].map((x) => wantBuffer(x));
}

export enum KeyDerivation {
	Concat = 'concat',
	DjangoConcat = 'django-concat',
	HMAC = 'hmac',
	None = 'none',
}

export type SignerOptions = {
	secretKey: SecretKey;
	salt?: StringBuffer;
	separator?: StringBuffer;
	keyDerivation?: KeyDerivation;
	digestMethod?: string;
	algorithm?: SigningAlgorithm;
};

export class Signer {
	public defaultDigestMethod = 'SHA-1';
	public defaultKeyDerivation = KeyDerivation.DjangoConcat;
	public secretKeys: Uint8Array[];
	public separator: Uint8Array;
	public salt: Uint8Array;
	public keyDerivation: KeyDerivation;
	public digestMethod: string;
	public algorithm: SigningAlgorithm;

	/**
	 * Creates an instance of Signer.
	 * @param {SignerOptions} options - The options for the signer.
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
	 * Derives a key using the specified key derivation method.
	 * @param {StringBuffer} [secretKey] - The secret key to derive from.
	 * @returns {Promise<Uint8Array>} The derived key.
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
	 * Generates a signature for the given value.
	 * @param {StringBuffer} value - The value to sign.
	 * @returns {Promise<Uint8Array>} The generated signature.
	 */
	public async getSignature(value: StringBuffer): Promise<Uint8Array> {
		const key = await this.deriveKey();
		const signature = await this.algorithm.getSignature(key, wantBuffer(value));
		return base64Encode(signature);
	}

	/**
	 * Signs the provided value.
	 * @param {StringBuffer} value - The value to sign.
	 * @returns {Promise<Uint8Array>} The signed value.
	 */
	public async sign(value: StringBuffer): Promise<Uint8Array> {
		const bufferValue = wantBuffer(value);
		const signature = await this.getSignature(value);
		return concatUint8Arrays([bufferValue, this.separator, signature]);
	}

	/**
	 * Verifies if the provided signature is valid for the given value.
	 * @param {StringBuffer} value - The value to verify.
	 * @param {StringBuffer} sig - The signature to verify.
	 * @returns {Promise<boolean>} Whether the signature is valid.
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
	 * Unsigns the signed value and returns the original value if the signature is
	 * valid.
	 * @param {StringBuffer} signedValue - The signed value to unsign.
	 * @returns {Promise<Uint8Array>} The original value.
	 * @throws {BadSignatureError} If the signature is invalid or the separator is
	 * not found.
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
	 * Validates the signed value.
	 * @param {StringBuffer} signedValue - The signed value to validate.
	 * @returns {Promise<boolean>} Whether the signed value is valid.
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
