import {describe, expect, test, vi} from 'vitest';
import {BadTimeSignature, Signer, SignerOptions, TimedSerializer, TimestampSigner} from '../src';
import {withThrows} from './utils';

function signerFactory(options?: Partial<SignerOptions>): TimestampSigner {
  return new TimestampSigner({secretKey: 'secret-key', ...options});
}

const MOCK_DATE = new Date('2011-06-24T00:09:05.000Z');

describe('timestampSigner', () => {
  test('maxAge', () => {
    vi.setSystemTime(MOCK_DATE);
    const signer = signerFactory();
    const signed = signer.sign('value');
    vi.setSystemTime(MOCK_DATE.getTime() + 10000);
    expect(signer.unsign(signed, 10)).toEqual(Buffer.from('value'));
    vi.setSystemTime(MOCK_DATE.getTime() + 20000);
    const error = withThrows(() => signer.unsign(signed, 10), BadTimeSignature);
    expect(error.dateSigned).toBeInstanceOf(MOCK_DATE.constructor);
  });

  test('returnTimestamp', () => {
    vi.setSystemTime(MOCK_DATE);
    const signer = signerFactory();
    const signed = signer.sign('value');
    expect(signer.unsign(signed, undefined, true)).toEqual([Buffer.from('value'), MOCK_DATE]);
  });

  test('timestampMissing', () => {
    const signer = signerFactory();
    const other = new Signer({secretKey: 'secret-key'});
    const signed = other.sign('value');
    const error = withThrows(() => signer.unsign(signed), BadTimeSignature);
    expect(error.message).toMatch(/Missing/);
    expect(error.dateSigned).toBeUndefined();
  });

  test('malformedTimestamp', () => {
    const signer = signerFactory();
    const other = new Signer({secretKey: 'secret-key'});
    const signed = other.sign('value.____________');
    const error = withThrows(() => signer.unsign(signed), BadTimeSignature);
    expect(error.message).toMatch(/Malformed/);
    expect(error.dateSigned).toBeUndefined();
  });

  test('malformedFutureTimestamp', () => {
    const signer = signerFactory();
    const signed = Buffer.from('value.TgPVoaGhoQ.AGBfQ6G6cr07byTRt0zAdPljHOY');
    const error = withThrows(() => signer.unsign(signed), BadTimeSignature);
    expect(error.message).toMatch(/Malformed/);
    expect(error.dateSigned).toBeUndefined();
  });

  test('futureAge', () => {
    const signer = signerFactory();
    const signed = signer.sign('value');
    vi.setSystemTime(new Date('1971-05-31'));
    const error = withThrows(() => signer.unsign(signed, 10), BadTimeSignature);
    expect(error.dateSigned).toBeInstanceOf(MOCK_DATE.constructor);
  });

  test('sigErrorDateSigned', () => {
    vi.setSystemTime(MOCK_DATE);
    const signer = signerFactory();
    const signed = signer.sign('my string').toString().replace('my', 'other');
    const error = withThrows(() => signer.unsign(signed), BadTimeSignature);
    expect(error.dateSigned).toBeInstanceOf(MOCK_DATE.constructor);
  });
});

function serializerFactory(serializerType: typeof TimedSerializer): TimedSerializer {
  return new serializerType({secretKey: 'secret-key'});
}

describe('timedSerializer', () => {
  test('maxAge', () => {
    vi.setSystemTime(MOCK_DATE);
    const serializer = serializerFactory(TimedSerializer);
    const value = {id: 42};
    const signed = serializer.stringify(value);
    vi.setSystemTime(MOCK_DATE.getTime() + 10000);
    expect(serializer.parse(signed, undefined, 10)).toEqual(value);
    vi.setSystemTime(MOCK_DATE.getTime() + 20000);
    const error = withThrows(() => serializer.parse(signed, undefined, 10), BadTimeSignature);
    expect(error.dateSigned).toBeInstanceOf(MOCK_DATE.constructor);
    expect(serializer.parsePayload(error.payload)).toEqual(value);
  });

  test('returnPayload', () => {
    vi.setSystemTime(MOCK_DATE);
    const serializer = serializerFactory(TimedSerializer);
    const value = {id: 42};
    const signed = serializer.stringify(value);
    expect(serializer.parse(signed, undefined, undefined, true)).toEqual([value, MOCK_DATE]);
  });
});
