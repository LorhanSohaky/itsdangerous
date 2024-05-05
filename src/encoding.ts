import {Buffer} from 'node:buffer';
import {BadDataError} from './errors.ts';
import type {StringBuffer} from './types.ts';

/**
 * Convert a string or buffer to a buffer.
 *
 * @param string The string or buffer to convert.
 * @param encoding The encoding to use when converting a string to a buffer.
 *  Defaults to 'utf8'.
 * @returns The buffer.
 */
export function wantBuffer(string: StringBuffer, encoding: 'utf8' | 'ascii' = 'utf8'): Buffer {
  return typeof string === 'string' ? Buffer.from(string, encoding) : string;
}

/**
 * Convert a string or buffer to a base64-encoded buffer.
 *
 * @param string The string or buffer to convert.
 * @returns The base64-encoded buffer.
 */
export function base64Encode(string: StringBuffer): Buffer {
  return Buffer.from(wantBuffer(string).toString('base64url'));
}

/**
 * Convert a base64-encoded string or buffer to a buffer.
 *
 * @param string The base64-encoded string or buffer to convert.
 * @returns The buffer.
 */
export function base64Decode(string: StringBuffer): Buffer {
  string = wantBuffer(string, 'ascii');
  try {
    return Buffer.from(string.toString(), 'base64url');
  } catch {
    throw new BadDataError('Invalid base64-encoded data');
  }
}

/**
 * The base64 alphabet used for encoding and decoding.
 */
export const BASE64_ALPHABET = Buffer.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_=');

/**
 * Convert a buffer to a base64url-encoded string.
 *
 * @param buf The buffer to convert.
 * @returns The base64url-encoded string.
 */
export function intToBuffer(num: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(num));
  let firstNonZeroIdx = 0;
  for (; firstNonZeroIdx < buf.length; firstNonZeroIdx++) {
    if (buf[firstNonZeroIdx] !== 0) {
      break;
    }
  }
  return buf.subarray(firstNonZeroIdx);
}

/**
 * Convert a buffer to a number.
 *
 * @param buf The buffer to convert.
 * @returns The number.
 */
export function bufferToInt(buf: Buffer): number | bigint {
  const fullBuf = Buffer.alloc(8);
  buf.copy(fullBuf, 8 - buf.length);
  const num = fullBuf.readBigUInt64BE();
  if (num <= Number.MAX_SAFE_INTEGER) {
    return Number(num);
  }
  return num;
}
