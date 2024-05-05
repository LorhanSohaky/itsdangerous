import type {Buffer} from 'node:buffer';

export type StringBuffer = string | Buffer;
export type SecretKey = Iterable<StringBuffer> | StringBuffer;
