import {areUint8ArraysEqual} from 'uint8array-extras';
import {describe, expect, test} from 'vitest';
import {base64Decode, base64Encode, bufferToInt, intToBuffer, wantBuffer} from '../src/index.ts';

describe('encoding', () => {
	test.each(['mañana', wantBuffer('tomorrow')])('wantBuffer', (value) => {
		const out = wantBuffer(value);
		expect(out instanceof Uint8Array).toEqual(true);
	});

	test.each(['無限', wantBuffer('infinite')])('base64', (value) => {
		const encoded = base64Encode(value);
		expect(encoded instanceof Uint8Array).toEqual(true);
		const decoded = base64Decode(encoded);
		expect(areUint8ArraysEqual(decoded, wantBuffer(value))).toEqual(true);
	});

	test.each([
		[0, wantBuffer('')],
		[192, new Uint8Array([0xc0])],
		[18_446_744_073_709_551_615n, new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])],
	])('intToBuffer', (value, expectedValue) => {
		const encoded = intToBuffer(value);
		expect(areUint8ArraysEqual(encoded, expectedValue)).toEqual(true);
		const decoded = bufferToInt(encoded);
		expect(decoded).toEqual(value);
	});
});
