import zlib from 'node:zlib';
import {Mixin} from 'ts-mixer';
import {Class} from 'ts-mixer/dist/types/types';
import {base64Decode, base64Encode} from './encoding.ts';
import {BadPayload} from './errors.ts';
import {DefaultSerializer, Serializer} from './serializer.ts';
import {TimedSerializer} from './timed.ts';

const zlibDecompress = zlib.inflateSync;
const zlibCompress = zlib.deflateSync;

/**
 * Mixed in with a regular serializer it will attempt to zlib-compress the
 * string to make it shorter if necessary. It will also base64-encode the string
 * so that it can safely be placed in a URL.
 */
export class URLSafeSerializerMixin extends Serializer {
  override parsePayload(payload: Buffer, serializer?: DefaultSerializer): any {
    let decompress = false;
    if (payload.toString().startsWith('.')) {
      payload = Buffer.from(payload.toString().slice(1));
      decompress = true;
    }

    let json: Buffer | undefined;
    try {
      json = base64Decode(payload);
    } catch (error) {
      throw new BadPayload('Could not base64-decode the payload because of an error', error);
    }

    if (decompress) {
      try {
        json = zlibDecompress(json);
      } catch (error) {
        throw new BadPayload('Could not zlib-decompress the payload before decoding the payload', error);
      }
    }

    return super.parsePayload(json, serializer);
  }

  override stringifyPayload(obj: any): Buffer {
    let json = super.stringifyPayload(obj);
    let isCompressed = false;
    let compressed = zlibCompress(json);
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
}

/**
 * Works like `Serializer` but dumps and loads into a URL-safe string consisting
 * of upper- and lowercase characters of the alphabet as well as `'_'`, `'-'`
 * and `'.'`.
 */
export const URLSafeSerializer: Class<
  any[],
  URLSafeSerializerMixin & Serializer,
  typeof URLSafeSerializerMixin & typeof Serializer
> = Mixin(URLSafeSerializerMixin, Serializer);

/**
 * Works like `TimedSerializer` but dumps and loads into a URL-safe string
 * consisting of upper- and lowercase characters of the alphabet as well as
 * `'_'`, `'-'` and `'.'`.
 */
export const URLSafeTimedSerializer: Class<
  any[],
  URLSafeSerializerMixin & TimedSerializer,
  typeof URLSafeSerializerMixin & typeof TimedSerializer
> = Mixin(URLSafeSerializerMixin, TimedSerializer);
