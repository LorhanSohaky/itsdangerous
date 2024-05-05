import {Buffer} from 'node:buffer';
import {describe, expect, test} from 'vitest';
import {BadPayload, BadSignature, Serializer, URLSafeSerializer, URLSafeTimedSerializer} from '../src';
import {rsplit} from '../src/utils';
import {withThrows} from './utils';

function coerceString(ref: string, s: string): string;
// eslint-disable-next-line no-redeclare
function coerceString(ref: Buffer, s: string): Buffer;
// eslint-disable-next-line no-redeclare
function coerceString(ref: string | Buffer, s: string): string | Buffer {
  return ref instanceof Buffer ? Buffer.from(s) : s;
}

function serializerFactory(serializerType: typeof Serializer): Serializer {
  return new serializerType({secretKey: 'secret-key'});
}

function factory(digestMethod?: string): Serializer {
  return new Serializer({secretKey: 'dev key', salt: 'dev salt', signerOpts: {digestMethod}});
}

describe.each([Serializer, URLSafeSerializer, URLSafeTimedSerializer])('serializer', (serializerType) => {
  test.each([null, true, 'str', 'text', [1, 2, 3], {id: 42}])('serializer', (value) => {
    const serializer = serializerFactory(serializerType);
    expect(serializer.parse(serializer.stringify(value))).toEqual(value);
  });

  test.each([
    (s: string): string => s.toUpperCase(),
    (s: string): string => s + coerceString(s, 'a'),
    (s: string): string => coerceString(s, 'a') + s.slice(1),
    (s: string): string => s.replace(coerceString(s, '.'), coerceString(s, '')),
  ])('changedValue', (transform) => {
    const serializer = serializerFactory(serializerType);
    const value = {id: 42};
    const signed = serializer.stringify(value);
    expect(serializer.parse(signed)).toEqual(value);
    const changed = transform(signed.toString());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(() => serializer.parse(changed)).toThrow(BadSignature);
  });

  test('badSignatureError', () => {
    const serializer = serializerFactory(serializerType);
    const value = {id: 42};
    const badSigned = serializer.stringify(value).slice(0, -1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const error = withThrows(() => serializer.parse(badSigned), BadSignature);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(serializer.parsePayload(error.payload)).toEqual(value);
  });

  test('badPayloadError', () => {
    const serializer = serializerFactory(serializerType);
    const value = {id: 42};
    const original = serializer.stringify(value);
    const [payload] = rsplit(original, '.', 1);
    const bad = serializer.makeSigner().sign(payload.subarray(0, -1));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const error = withThrows(() => serializer.parse(bad), BadPayload);
    expect(error.originalError != null).toEqual(true);
  });

  test('parseUnsafe', () => {
    const serializer = serializerFactory(serializerType);
    const value = {id: 42};
    const signed = serializer.stringify(value);
    expect(serializer.parseUnsafe(signed)).toEqual([true, value]);
    const badSigned = signed.slice(0, -1);
    expect(serializer.parseUnsafe(badSigned)).toEqual([false, value]);
    const [payload] = rsplit(signed, '.', 1);
    const badPayload = serializer.makeSigner().sign(payload.subarray(0, -1)).subarray(0, -1);
    expect(serializer.parseUnsafe(badPayload)).toEqual([false, null]);
  });

  test('altSalt', () => {
    const serializer = serializerFactory(serializerType);
    const value = {id: 42};
    const signed = serializer.stringify(value, 'other');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(() => serializer.parse(signed)).toThrow(BadSignature);
    expect(serializer.parse(signed, 'other')).toEqual(value);
  });

  test('digests', () => {
    const defaultValue = factory().stringify([42]).toString();
    const sha1Value = factory('sha1').stringify([42]).toString();
    const sha512Value = factory('sha512').stringify([42]).toString();
    expect(defaultValue).toEqual(sha1Value);
    expect(sha1Value).toEqual('[42].-9cNi0CxsSB3hZPNCe9a2eEs1ZM');
    expect(sha512Value).toEqual(
      '[42].MKCz_0nXQqv7wKpfHZcRtJRmpT2T5uvs9YQsJEhJimqxc9bCLxG31QzS5uC8OVBI1i6jyOLAFNoKaF5ckO9L5Q',
    );
  });
});
