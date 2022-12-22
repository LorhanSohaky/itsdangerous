import {BadData} from './errors.js';
import type {StringBuffer} from './types.js';

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
