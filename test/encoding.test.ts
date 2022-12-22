import {describe, expect, test} from 'vitest';
import {base64Decode, base64Encode, wantBuffer} from '../src';

describe('encoding', () => {
  test.each(['mañana', Buffer.from('tomorrow')])('wantBuffer', (value) => {
    const out = wantBuffer(value);
    expect(out instanceof Buffer).toEqual(true);
  });

  test.each(['無限', Buffer.from('infinite')])('base64', (value) => {
    const enc = base64Encode(value);
    expect(enc instanceof Buffer).toEqual(true);
    const dec = base64Decode(enc);
    expect(dec.equals(wantBuffer(value))).toEqual(true);
  });
});
