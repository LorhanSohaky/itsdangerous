import {concatUint8Arrays} from 'uint8array-extras';
import {describe, expect, test} from 'vitest';
import {
	BadSignatureError,
	HMACAlgorithm,
	KeyDerivation,
	NoneAlgorithm,
	Signer,
	type SignerOptions,
	SigningAlgorithm,
	wantBuffer,
} from '../src/index.ts';
import {withThrows} from './utils.ts';

class ReverseAlgorithm extends SigningAlgorithm {
	public override async getSignature(key: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
		return concatUint8Arrays([key, value]).reverse();
	}
}

function signerFactory(options?: Partial<SignerOptions>): Signer {
	return new Signer({secretKey: 'secret-key', ...options});
}

describe('signer', () => {
	test('signer', async () => {
		const signer = signerFactory();
		const signed = await signer.sign('my string');
		expect(signed instanceof Uint8Array).toEqual(true);
		expect(await signer.validate(signed)).toEqual(true);
		const out = await signer.unsign(signed);
		expect(new TextDecoder().decode(out)).toEqual('my string');
	});

	test('noSeparator', async () => {
		const signer = signerFactory();
		const signed = await signer.sign('my string');
		const signedTampered = wantBuffer(
			new TextDecoder().decode(signed).replace(new TextDecoder().decode(signer.separator), '*'),
		);
		expect(await signer.validate(signedTampered)).toEqual(false);
		await expect(signer.unsign(signedTampered)).rejects.toThrow(BadSignatureError);
	});

	test('brokenSignature', async () => {
		const signer = signerFactory();
		const badSigned = await signer.sign('b');
		const separatorIndex = badSigned.lastIndexOf(signer.separator[0]);
		const invalidSig = badSigned.slice(separatorIndex + signer.separator.length);
		invalidSig[invalidSig.length - 1] ^= 0xff; // Flip the last byte
		const tamperedSigned = concatUint8Arrays([
			badSigned.slice(0, separatorIndex + signer.separator.length),
			invalidSig,
		]);
		const isValid = await signer.verifySignature(badSigned.slice(0, separatorIndex), invalidSig);
		expect(isValid).toEqual(false);
		await expect(signer.unsign(tamperedSigned)).rejects.toThrow(BadSignatureError);
	});

	test('changedValue', async () => {
		const signer = signerFactory();
		const signed = await signer.sign('my string');
		const signedTampered = wantBuffer(new TextDecoder().decode(signed).replace('my', 'other'));
		expect(await signer.validate(signedTampered)).toEqual(false);
		await expect(signer.unsign(signedTampered)).rejects.toThrow(BadSignatureError);
	});

	test('invalidSeparator', async () => {
		const error = await withThrows(async () => signerFactory({separator: '-'}), TypeError);
		expect(error.message).includes('separator cannot be used');
	});

	test.each([
		KeyDerivation.Concat,
		KeyDerivation.DjangoConcat,
		KeyDerivation.HMAC,
		KeyDerivation.None,
	])('keyDerivation', async (keyDerivation) => {
		const signer = signerFactory({keyDerivation});
		expect(new TextDecoder().decode(await signer.unsign(await signer.sign('value')))).toEqual('value');
	});

	test('invalidKeyDerivation', async () => {
		// @ts-expect-error this is testing invalid input
		const signer = signerFactory({keyDerivation: 'invalid'});
		await expect(signer.deriveKey()).rejects.toThrow(TypeError);
	});

	test('digestMethod', async () => {
		const signer = signerFactory({digestMethod: 'SHA-256'});
		expect(new TextDecoder().decode(await signer.unsign(await signer.sign('value')))).toEqual('value');
	});

	test.each([
		undefined,
		new NoneAlgorithm(),
		new HMACAlgorithm(),
		new ReverseAlgorithm(),
	])('algorithm', async (algorithm) => {
		const signer = signerFactory({algorithm});
		expect(new TextDecoder().decode(await signer.unsign(await signer.sign('value')))).toEqual('value');
		if (algorithm == null) {
			expect(signer.algorithm.digestMethod).toEqual(signer.digestMethod);
		}
	});

	test('secretKeys', async () => {
		let signer = new Signer({secretKey: 'a'});
		const signed = await signer.sign('my string');
		expect(signed instanceof Uint8Array).toEqual(true);
		signer = new Signer({secretKey: ['a', 'b']});
		expect(await signer.validate(signed)).toEqual(true);
		const out = await signer.unsign(signed);
		expect(new TextDecoder().decode(out)).toEqual('my string');
	});
});
