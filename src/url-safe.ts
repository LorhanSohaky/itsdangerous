import pako from 'pako';
import {concatUint8Arrays} from 'uint8array-extras';
import {base64Decode, base64Encode, wantBuffer} from './encoding.ts';
import {BadPayloadError} from './errors.ts';
import {type DefaultSerializer, Serializer} from './serializer.ts';
import {TimedSerializer} from './timed.ts';
import type {$TsFixMe} from './types.ts';

/**
 * Decompresses a compressed Uint8Array using the pako library.
 * @param {Uint8Array} buffer - The compressed data to decompress.
 * @returns {Uint8Array} - The decompressed data.
 */
function pakoDecompress(buffer: Uint8Array): Uint8Array {
	return pako.inflate(buffer);
}

/**
 * Compresses a Uint8Array using the pako library.
 * @param {Uint8Array} buffer - The data to compress.
 * @returns {Uint8Array} - The compressed data.
 */
function pakoCompress(buffer: Uint8Array): Uint8Array {
	return pako.deflate(buffer);
}

/**
 * Decodes a payload from a Uint8Array. If the payload is compressed, it
 * decompresses it after decoding.
 * @param {Uint8Array} payload - The payload to decode, potentially compressed
 * and base64 encoded.
 * @returns {Uint8Array} - The decoded and possibly decompressed payload.
 * @throws {BadPayloadError} - If decoding or decompression fails.
 */
function decodePayload(payload: Uint8Array): Uint8Array {
	let decompress = false;
	let slicedPayload = payload;

	// Check if the payload is marked as compressed by a leading dot ('.')
	if (slicedPayload[0] === 46) {
		slicedPayload = slicedPayload.slice(1);
		decompress = true;
	}

	let decodedPayload: Uint8Array;
	try {
		decodedPayload = base64Decode(slicedPayload);
	} catch (error) {
		throw new BadPayloadError('Failed to base64-decode the payload due to an error.', error);
	}

	if (decompress) {
		try {
			decodedPayload = pakoDecompress(decodedPayload);
		} catch (error) {
			throw new BadPayloadError('Failed to decompress the payload after decoding.', error);
		}
	}

	return decodedPayload;
}

/**
 * Encodes a JSON payload into a compressed and base64-encoded Uint8Array if
 * compression is beneficial.
 * @param {Uint8Array} json - The JSON payload to encode.
 * @returns {Uint8Array} - The encoded (and possibly compressed) payload.
 */
function encodePayload(json: Uint8Array): Uint8Array {
	const compressed = pakoCompress(json);
	const isCompressed = compressed.length < json.length - 1;
	const processedJson = isCompressed ? compressed : json;
	let base64Payload = base64Encode(processedJson);

	// Prepend a dot ('.') to indicate that the payload is compressed
	if (isCompressed) {
		base64Payload = concatUint8Arrays([wantBuffer('.'), base64Payload]);
	}

	return wantBuffer(base64Payload);
}

/**
 * A serializer that provides additional functionality for URL-safe compression
 * and encoding. This class attempts to compress and encode strings to make them
 * shorter if necessary, ensuring the result can be safely used in URLs.
 */
class URLSafeSerializerBase extends Serializer {
	/**
	 * Parses a compressed and encoded payload into an object. Decompresses and
	 * decodes the payload if necessary.
	 * @param {Uint8Array} payload - The payload to parse.
	 * @param {DefaultSerializer} [serializer] - An optional serializer to use
	 * instead of the default.
	 * @returns {$TsFixMe} - The parsed object.
	 */
	public override parsePayload(payload: Uint8Array, serializer?: DefaultSerializer): $TsFixMe {
		const json = decodePayload(payload);
		return super.parsePayload(json, serializer);
	}

	/**
	 * Stringifies an object into a payload and compresses/encodes it for URL-safe
	 * usage if necessary.
	 * @param {$TsFixMe} object - The object to stringify and encode.
	 * @returns {Uint8Array} - The encoded payload.
	 */
	public override stringifyPayload(object: $TsFixMe): Uint8Array {
		const json = super.stringifyPayload(object);
		return encodePayload(json);
	}
}

export class URLSafeSerializer extends URLSafeSerializerBase {}

/**
 * A specialized serializer that extends `TimedSerializer` with URL-safe
 * compression and encoding. This serializer encodes the data into a string
 * format that is safe for use in URLs, using characters from the alphabet and
 * the symbols `'_'`, `'-'`, and `'.'`.
 */
export class URLSafeTimedSerializer extends TimedSerializer {
	/**
	 * Parses a compressed and encoded payload into an object. Decompresses and
	 * decodes the payload if necessary.
	 * @param {Uint8Array} payload - The payload to parse.
	 * @param {DefaultSerializer} [serializer] - An optional serializer to use
	 * instead of the default.
	 * @returns {$TsFixMe} - The parsed object.
	 */
	public override parsePayload(payload: Uint8Array, serializer?: DefaultSerializer): $TsFixMe {
		const json = decodePayload(payload);
		return super.parsePayload(json, serializer);
	}

	/**
	 * Stringifies an object into a payload and compresses/encodes it for URL-safe
	 * usage if necessary.
	 * @param {$TsFixMe} object - The object to stringify and encode.
	 * @returns {Uint8Array} - The encoded payload.
	 */
	public override stringifyPayload(object: $TsFixMe): Uint8Array {
		const json = super.stringifyPayload(object);
		return encodePayload(json);
	}
}
