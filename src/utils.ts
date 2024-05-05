import {Buffer} from 'node:buffer';
import type {StringBuffer} from './types.ts';

export function rsplit(string: StringBuffer, sep: StringBuffer, maxSplit: number): Buffer[] {
  const split = string.toString().split(sep.toString());
  const result = maxSplit ? [split.slice(0, -maxSplit).join(sep.toString()), ...split.slice(-maxSplit)] : split;
  return result.map((s) => Buffer.from(s));
}
