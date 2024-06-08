import {describe, expect, test} from 'vitest';
import {
	BadPayloadError,
	BadSignatureError,
	Serializer,
	URLSafeSerializer,
	URLSafeTimedSerializer,
	wantBuffer,
} from '../src/index.ts';

function serializerFactory(serializerType: typeof Serializer): Serializer {
	return new serializerType({secretKey: 'secret-key'});
}

function factory(digestMethod?: string): Serializer {
	return new Serializer({
		secretKey: 'dev key',
		salt: 'dev salt',
		signerOpts: {digestMethod},
	});
}

function findLastDotIndex(buffer: Uint8Array): number {
	for (let i = buffer.length - 1; i >= 0; i--) {
		if (buffer[i] === 46) {
			// 46 is the ASCII code for '.'
			return i;
		}
	}
	return -1;
}

describe.each([Serializer, URLSafeSerializer, URLSafeTimedSerializer])('serializer', (serializerType) => {
	test.each([null, true, 'str', 'text', [1, 2, 3], {id: 42}])('serializer', async (value) => {
		const serializer = serializerFactory(serializerType);
		const signed = await serializer.stringify(value);
		expect(await serializer.parse(signed)).toEqual(value);
	});

	test.each([
		(s: string): string => s.toUpperCase(),
		(s: string): string => `${s}a`,
		(s: string): string => `a${s.slice(1)}`,
		(s: string): string => s.replace('.', ''),
	])('changedValue', async (transform) => {
		const serializer = serializerFactory(serializerType);
		const value = {id: 42};
		const signed = await serializer.stringify(value);
		expect(await serializer.parse(signed)).toEqual(value);
		const changed = transform(signed);
		await expect(serializer.parse(changed)).rejects.toThrow(BadSignatureError);
	});

	test('badSignatureError', async () => {
		const serializer = serializerFactory(serializerType);
		const value = {id: 42};
		const signed = await serializer.stringify(value);
		const badSigned = signed.slice(0, -1); // Remove last character to invalidate signature
		await expect(serializer.parse(badSigned)).rejects.toThrow(BadSignatureError);
	});

	test('badPayloadError', async () => {
		const serializer = serializerFactory(serializerType);
		const value = {id: 42};
		const original = wantBuffer(await serializer.stringify(value));
		const lastIndex = findLastDotIndex(original);
		const payload = original.subarray(0, lastIndex);
		const badPayload = payload.subarray(0, -1); // Invalidate payload
		const bad = await serializer.makeSigner().sign(badPayload);
		await expect(serializer.parse(bad)).rejects.toThrow(BadPayloadError);
	});

	test('parseUnsafe', async () => {
		const serializer = serializerFactory(serializerType);
		const value = {id: 42};
		const signed = wantBuffer(await serializer.stringify(value));
		expect(await serializer.parseUnsafe(signed)).toEqual([true, value]);
		const badSigned = signed.slice(0, -1);
		expect(await serializer.parseUnsafe(badSigned)).toEqual([false, null]);
		const lastIndex = findLastDotIndex(signed);
		const badPayload = signed.subarray(0, lastIndex - 1); // Invalidate payload
		const badSignedPayload = await serializer.makeSigner().sign(badPayload);
		expect(await serializer.parseUnsafe(badSignedPayload)).toEqual([false, null]);
	});

	test('altSalt', async () => {
		const serializer = serializerFactory(serializerType);
		const value = {id: 42};
		const signed = await serializer.stringify(value, 'other');
		await expect(serializer.parse(signed)).rejects.toThrow(BadSignatureError);
		expect(await serializer.parse(signed, 'other')).toEqual(value);
	});

	test('digests', async () => {
		const defaultValue = await factory().stringify([42]);
		const sha1Value = await factory('SHA-1').stringify([42]);
		const sha512Value = await factory('SHA-512').stringify([42]);
		expect(defaultValue).toEqual(sha1Value);
		expect(sha1Value).toEqual('[42].-9cNi0CxsSB3hZPNCe9a2eEs1ZM');
		expect(sha512Value).toEqual(
			// TODO: Why does this end with a Q? It should end with an A.
			'[42].MKCz_0nXQqv7wKpfHZcRtJRmpT2T5uvs9YQsJEhJimqxc9bCLxG31QzS5uC8OVBI1i6jyOLAFNoKaF5ckO9L5Q',
		);
	});

	test('readme', async () => {
		const serializer = new URLSafeSerializer({secretKey: 'secret key', salt: 'auth'});
		const token = await serializer.stringify({id: 5, name: 'itsdangerous'});
		expect(token).toEqual('eyJpZCI6NSwibmFtZSI6Iml0c2Rhbmdlcm91cyJ9.6YP6T0BaO67XP--9UzTrmurXSmg');
		const data = await serializer.parse(token);
		expect(data.name).toEqual('itsdangerous');
	});
});
