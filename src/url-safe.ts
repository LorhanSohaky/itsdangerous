import pako from 'pako';
import {concatUint8Arrays} from 'uint8array-extras';
import {base64Decode, base64Encode, wantBuffer} from './encoding.ts';
import {BadPayloadError} from './errors.ts';
import {type DefaultSerializer, Serializer} from './serializer.ts';
import {TimedSerializer} from './timed.ts';
import type {$TsFixMe} from './types.ts';

/**
 * Decompresses a given Uint8Array using pako.
 * @param {Uint8Array} buffer - The compressed data.
 * @returns {Uint8Array} The decompressed data.
 */
function pakoDecompress(buffer: Uint8Array): Uint8Array {
	return pako.inflate(buffer);
}

/**
 * Compresses a given Uint8Array using pako.
 * @param {Uint8Array} buffer - The data to compress.
 * @returns {Uint8Array} The compressed data.
 */
function pakoCompress(buffer: Uint8Array): Uint8Array {
	return pako.deflate(buffer);
}

/**
 * Decodes a payload from a Uint8Array. If the payload is compressed, it
 * decompresses it.
 * @param {Uint8Array} payload - The payload to decode.
 * @returns {Uint8Array} The decoded (and possibly decompressed) payload.
 * @throws {BadPayloadError} If decoding or decompression fails.
 */
function decodePayload(payload: Uint8Array): Uint8Array {
	let decompress = false;
	let slicedPayload = payload;

	if (slicedPayload[0] === 46) {
		slicedPayload = slicedPayload.slice(1);
		decompress = true;
	}

	let decodedPayload: Uint8Array;
	try {
		decodedPayload = base64Decode(slicedPayload);
	} catch (error) {
		throw new BadPayloadError('Could not base64-decode the payload due to an error', error);
	}

	if (decompress) {
		try {
			decodedPayload = pakoDecompress(decodedPayload);
		} catch (error) {
			throw new BadPayloadError('Could not decompress the payload after decoding', error);
		}
	}

	return decodedPayload;
}

/**
 * Encodes a JSON payload into a Uint8Array. If the payload can be compressed,
 * it compresses it before encoding.
 * @param {Uint8Array} json - The JSON payload to encode.
 * @returns {Uint8Array} The encoded (and possibly compressed) payload.
 */
function encodePayload(json: Uint8Array): Uint8Array {
	const compressed = pakoCompress(json);
	const isCompressed = compressed.length < json.length - 1;
	const processedJson = isCompressed ? compressed : json;
	let base64Payload = base64Encode(processedJson);

	if (isCompressed) {
		base64Payload = concatUint8Arrays([wantBuffer('.'), base64Payload]);
	}

	return wantBuffer(base64Payload);
}

class URLSafeSerializerBase extends Serializer {
	/**
	 * Parses a payload into an object. Decodes and decompresses the payload if
	 * necessary.
	 * @param {Uint8Array} payload - The payload to parse.
	 * @param {DefaultSerializer} [serializer] - An optional serializer to use.
	 * @returns {$TsFixMe} The parsed object.
	 */
	public override parsePayload(payload: Uint8Array, serializer?: DefaultSerializer): $TsFixMe {
		const json = decodePayload(payload);
		return super.parsePayload(json, serializer);
	}

	/**
	 * Stringifies an object into a payload. Compresses and encodes the payload if
	 * necessary.
	 * @param {$TsFixMe} object - The object to stringify.
	 * @returns {Uint8Array} The encoded payload.
	 */
	public override stringifyPayload(object: $TsFixMe): Uint8Array {
		const json = super.stringifyPayload(object);
		return encodePayload(json);
	}
}

export class URLSafeSerializer extends URLSafeSerializerBase {}

export class URLSafeTimedSerializer extends TimedSerializer {
	/**
	 * Parses a payload into an object. Decodes and decompresses the payload if
	 * necessary.
	 * @param {Uint8Array} payload - The payload to parse.
	 * @param {DefaultSerializer} [serializer] - An optional serializer to use.
	 * @returns {$TsFixMe} The parsed object.
	 */
	public override parsePayload(payload: Uint8Array, serializer?: DefaultSerializer): $TsFixMe {
		const json = decodePayload(payload);
		return super.parsePayload(json, serializer);
	}

	/**
	 * Stringifies an object into a payload. Compresses and encodes the payload if
	 * necessary.
	 * @param {$TsFixMe} object - The object to stringify.
	 * @returns {Uint8Array} The encoded payload.
	 */
	public override stringifyPayload(object: $TsFixMe): Uint8Array {
		const json = super.stringifyPayload(object);
		return encodePayload(json);
	}
}
