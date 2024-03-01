import {BadData} from './errors.ts';
import type {StringBuffer} from './types.ts';

export function wantBuffer(string: StringBuffer, encoding: BufferEncoding = 'utf8'): Buffer {
  return typeof string === 'string' ? Buffer.from(string, encoding) : string;
}

export function base64Encode(string: StringBuffer): Buffer {
  return Buffer.from(wantBuffer(string).toString('base64url'));
}

export function base64Decode(string: StringBuffer): Buffer {
  string = wantBuffer(string, 'ascii');
  try {
    return Buffer.from(string.toString(), 'base64url');
  } catch {
    throw new BadData('Invalid base64-encoded data');
  }
}

export const BASE64_ALPHABET = Buffer.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_=');

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

export function bufferToInt(buf: Buffer): number | bigint {
  const fullBuf = Buffer.alloc(8);
  buf.copy(fullBuf, 8 - buf.length);
  const num = fullBuf.readBigUInt64BE();
  if (num <= Number.MAX_SAFE_INTEGER) {
    return Number(num);
  }
  return num;
}
