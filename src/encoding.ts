import {base64ToUint8Array, stringToUint8Array, uint8ArrayToBase64} from 'uint8array-extras';
import {BadDataError} from './errors.ts';
import type {StringBuffer} from './types.ts';

export const BASE64_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_=';

/**
 * Converts a string or Uint8Array to a Uint8Array.
 * @param {StringBuffer} input - The input string or Uint8Array.
 * @returns {Uint8Array} The resulting Uint8Array.
 */
export function wantBuffer(input: StringBuffer): Uint8Array {
	return typeof input === 'string' ? stringToUint8Array(input) : input;
}

/**
 * Encodes a string or Uint8Array to a base64 encoded Uint8Array.
 * @param {StringBuffer} input - The input string or Uint8Array.
 * @returns {Uint8Array} The base64 encoded Uint8Array.
 */
export function base64Encode(input: StringBuffer): Uint8Array {
	const buffer = wantBuffer(input);
	return stringToUint8Array(uint8ArrayToBase64(buffer, {urlSafe: true}));
}

/**
 * Decodes a base64 encoded string or Uint8Array to a Uint8Array.
 * @param {StringBuffer} input - The base64 encoded string or Uint8Array.
 * @returns {Uint8Array} The decoded Uint8Array.
 * @throws {BadDataError} If the input data is not valid base64.
 */
export function base64Decode(input: StringBuffer): Uint8Array {
	try {
		const buffer = wantBuffer(input);
		const inputStr = new TextDecoder().decode(buffer);
		return base64ToUint8Array(inputStr);
	} catch {
		throw new BadDataError('Invalid base64-encoded data');
	}
}

/**
 * Converts an integer or bigint to a Uint8Array.
 * @param {number | bigint} number - The number or bigint to convert.
 * @returns {Uint8Array} The resulting Uint8Array.
 */
export function intToBuffer(number: number | bigint): Uint8Array {
	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	view.setBigUint64(0, BigInt(number), false);

	let firstNonZeroIndex = 0;
	while (firstNonZeroIndex < 8 && view.getUint8(firstNonZeroIndex) === 0) {
		firstNonZeroIndex++;
	}

	return new Uint8Array(buffer.slice(firstNonZeroIndex));
}

/**
 * Converts a Uint8Array to an integer or bigint.
 * @param {Uint8Array} buffer - The Uint8Array to convert.
 * @returns {number | bigint} The resulting integer or bigint.
 */
export function bufferToInt(buffer: Uint8Array): number | bigint {
	const fullBuffer = new ArrayBuffer(8);
	const view = new DataView(fullBuffer);
	const start = 8 - buffer.byteLength;

	for (const [index, byte] of buffer.entries()) {
		view.setUint8(start + index, byte);
	}

	const result = view.getBigUint64(0, false);
	return result <= Number.MAX_SAFE_INTEGER ? Number(result) : result;
}
