import {base64ToUint8Array, stringToUint8Array, uint8ArrayToBase64} from 'uint8array-extras';
import {BadDataError} from './errors.ts';
import type {StringBuffer} from './types.ts';

export const BASE64_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_=';

/**
 * Converts an input, either a string or a `Uint8Array`, to a `Uint8Array`. If
 * the input is already a `Uint8Array`, it is returned unchanged. If it is a
 * string, it is encoded as UTF-8.
 * @param {StringBuffer} input - The input value, which can be either a string
 * or a `Uint8Array`.
 * @returns {Uint8Array} - The resulting `Uint8Array`.
 */
export function wantBuffer(input: StringBuffer): Uint8Array {
	return typeof input === 'string' ? stringToUint8Array(input) : input;
}

/**
 * Encodes a string or `Uint8Array` into a Base64-encoded `Uint8Array`. The
 * output is URL-safe and does not include padding characters.
 * @param {StringBuffer} input - The input value, which can be either a string
 * or a `Uint8Array`.
 * @returns {Uint8Array} - The Base64-encoded `Uint8Array`.
 */
export function base64Encode(input: StringBuffer): Uint8Array {
	const buffer = wantBuffer(input);
	return stringToUint8Array(uint8ArrayToBase64(buffer, {urlSafe: true}));
}

/**
 * Decodes a Base64-encoded string or `Uint8Array` back into a `Uint8Array`. The
 * input can be either a URL-safe Base64 string or a `Uint8Array` containing
 * such a string.
 * @param {StringBuffer} input - The Base64-encoded input value, either as a
 * string or a `Uint8Array`.
 * @returns {Uint8Array} - The decoded `Uint8Array`.
 * @throws {BadDataError} - If the input data is not a valid Base64 string.
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
 * Converts a number or bigint into a `Uint8Array`. The resulting array is the
 * minimal length needed to represent the number. This method supports both
 * 64-bit integers and large bigint values.
 * @param {number | bigint} number - The number or bigint to convert to a
 * `Uint8Array`.
 * @returns {Uint8Array} - The resulting `Uint8Array` containing the binary
 * representation of the number.
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
 * Converts a `Uint8Array` into a number or bigint. This function handles up to
 * 64-bit integers. If the resulting value can fit within JavaScript's safe
 * integer range, a number is returned; otherwise, a bigint is returned.
 * @param {Uint8Array} buffer - The `Uint8Array` to convert to a number or
 * bigint.
 * @returns {number | bigint} - The resulting number or bigint.
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
