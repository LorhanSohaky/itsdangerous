import {Buffer} from 'node:buffer';
import zlib from 'node:zlib';
import {base64Decode, base64Encode} from './encoding.ts';
import {BadPayloadError} from './errors.ts';
import type {DefaultSerializer} from './serializer.ts';
import {Serializer} from './serializer.ts';
import {TimedSerializer} from './timed.ts';

const zlibDecompress = zlib.inflateSync;
const zlibCompress = zlib.deflateSync;

function processPayloadForParsing(payload: Buffer): Buffer {
  let decompress = false;
  if (payload.toString().startsWith('.')) {
    payload = Buffer.from(payload.toString().slice(1));
    decompress = true;
  }

  let json: Buffer | undefined;
  try {
    json = base64Decode(payload);
  } catch (error) {
    throw new BadPayloadError('Could not base64-decode the payload because of an error', error);
  }

  if (decompress) {
    try {
      json = zlibDecompress(json);
    } catch (error) {
      throw new BadPayloadError('Could not zlib-decompress the payload before decoding', error);
    }
  }

  return json;
}

function processPayloadForStringification(json: Buffer): Buffer {
  let isCompressed = false;
  const compressed = zlibCompress(json);
  if (compressed.length < json.length - 1) {
    json = compressed;
    isCompressed = true;
  }
  let base64d = base64Encode(json);
  if (isCompressed) {
    base64d = Buffer.from('.' + base64d.toString());
  }
  return base64d;
}

/**
 * Base class for URL-safe serializers.
 */
class URLSafeSerializerBase extends Serializer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public parsePayload(payload: Buffer, serializer?: DefaultSerializer): any {
    const json = processPayloadForParsing(payload);
    return super.parsePayload(json, serializer);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public stringifyPayload(obj: any): Buffer {
    const json = super.stringifyPayload(obj);
    return processPayloadForStringification(json);
  }
}

/**
 * Works like `Serializer` but dumps and loads into a URL-safe string consisting
 * of upper- and lowercase characters of the alphabet as well as `'_'`, `'-'`
 * and `'.'`.
 */
export class URLSafeSerializer extends URLSafeSerializerBase {}

/**
 * Works like `TimedSerializer` but dumps and loads into a URL-safe string
 * consisting of upper- and lowercase characters of the alphabet as well as
 * `'_'`, `'-'` and `'.'`.
 */
export class URLSafeTimedSerializer extends TimedSerializer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public parsePayload(payload: Buffer, serializer?: DefaultSerializer): any {
    const json = processPayloadForParsing(payload);
    return super.parsePayload(json, serializer);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public stringifyPayload(obj: any): Buffer {
    const json = super.stringifyPayload(obj);
    return processPayloadForStringification(json);
  }
}
