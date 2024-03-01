import {describe, expect, test} from 'vitest';
import {base64Decode, base64Encode, bufferToInt, intToBuffer, wantBuffer} from '../src';

describe('encoding', () => {
  test.each(['mañana', Buffer.from('tomorrow')])('wantBuffer', (value) => {
    const out = wantBuffer(value);
    expect(out instanceof Buffer).toEqual(true);
  });

  test.each(['無限', Buffer.from('infinite')])('base64', (value) => {
    const enc = base64Encode(value);
    expect(enc instanceof Buffer).toEqual(true);
    const dec = base64Decode(enc);
    expect(dec).toEqual(wantBuffer(value));
  });

  // TODO: Figure out how to get Node to throw an error here.
  // test('base64Decode bad', () => {
  //   expect(() => base64Decode('12345')).toThrow('Invalid base64-encoded data');
  // });

  test.each([
    [0, Buffer.from('')],
    [192, Buffer.from([0xc0])],
    [18446744073709551615n, Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])],
  ])('intToBuffer', (value, expectedValue) => {
    const enc = intToBuffer(value);
    expect(enc.equals(expectedValue)).toEqual(true);
    const dec = bufferToInt(enc);
    expect(dec).toEqual(value);
  });
});
