import {describe, expect, test, vi} from 'vitest';
import {
	BadTimeSignatureError,
	Signer,
	type SignerOptions,
	TimedSerializer,
	TimestampSigner,
	wantBuffer,
} from '../src/index.ts';
import {withThrows} from './utils.ts';

function signerFactory(options?: Partial<SignerOptions>): TimestampSigner {
	return new TimestampSigner({secretKey: 'secret-key', ...options});
}

const mockDate = new Date('2011-06-24T00:09:05.000Z');

describe('timestampSigner', () => {
	test('maxAge', async () => {
		vi.setSystemTime(mockDate);
		const signer = signerFactory();
		const signed = await signer.sign('value');
		vi.setSystemTime(mockDate.getTime() + 10_000);
		expect(await signer.unsign(signed, 10)).toEqual(wantBuffer('value'));
		vi.setSystemTime(mockDate.getTime() + 20_000);
		const error = await withThrows(async () => signer.unsign(signed, 10), BadTimeSignatureError);
		expect(error.dateSigned).toBeInstanceOf(mockDate.constructor);
	});

	test('returnTimestamp', async () => {
		vi.setSystemTime(mockDate);
		const signer = signerFactory();
		const signed = await signer.sign('value');
		expect(await signer.unsign(signed, undefined, true)).toEqual([wantBuffer('value'), mockDate]);
	});

	test('timestampMissing', async () => {
		const signer = signerFactory();
		const other = new Signer({secretKey: 'secret-key'});
		const signed = await other.sign('value');
		const error = await withThrows(async () => signer.unsign(signed), BadTimeSignatureError);
		expect(error.message).toMatch(/Missing/);
		expect(error.dateSigned).toBeUndefined();
	});

	test('malformedTimestamp', async () => {
		const signer = signerFactory();
		const other = new Signer({secretKey: 'secret-key'});
		const signed = await other.sign('value.____________');
		const error = await withThrows(async () => signer.unsign(signed), BadTimeSignatureError);
		expect(error.message).toMatch(/Malformed/);
		expect(error.dateSigned).toBeUndefined();
	});

	test('malformedFutureTimestamp', async () => {
		const signer = signerFactory();
		const signed = wantBuffer('value.TgPVoaGhoQ.AGBfQ6G6cr07byTRt0zAdPljHOY');
		const error = await withThrows(async () => signer.unsign(signed), BadTimeSignatureError);
		expect(error.message).toMatch(/Malformed/);
		expect(error.dateSigned).toBeUndefined();
	});

	test('futureAge', async () => {
		const signer = signerFactory();
		const signed = await signer.sign('value');
		vi.setSystemTime(new Date('1971-05-31'));
		const error = await withThrows(async () => signer.unsign(signed, 10), BadTimeSignatureError);
		expect(error.dateSigned).toBeInstanceOf(mockDate.constructor);
	});

	test('sigErrorDateSigned', async () => {
		vi.setSystemTime(mockDate);
		const signer = signerFactory();
		const signed = await signer.sign('my string');
		const signedTampered = wantBuffer(new TextDecoder().decode(signed).replace('my', 'other'));
		await expect(signer.unsign(signedTampered)).rejects.toThrow(BadTimeSignatureError);
	});
});

function serializerFactory(serializerType: typeof TimedSerializer): TimedSerializer {
	return new serializerType({secretKey: 'secret-key'});
}

describe('timedSerializer', () => {
	test('maxAge', async () => {
		vi.setSystemTime(mockDate);
		const serializer = serializerFactory(TimedSerializer);
		const value = {id: 42};
		const signed = await serializer.stringify(value);
		vi.setSystemTime(mockDate.getTime() + 10_000);
		expect(await serializer.parse(signed, undefined, 10)).toEqual(value);
		vi.setSystemTime(mockDate.getTime() + 20_000);
		const error = await withThrows(async () => serializer.parse(signed, undefined, 10), BadTimeSignatureError);
		expect(error.dateSigned).toBeInstanceOf(mockDate.constructor);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		expect(serializer.parsePayload(error.payload!)).toEqual(value);
	});

	test('returnPayload', async () => {
		vi.setSystemTime(mockDate);
		const serializer = serializerFactory(TimedSerializer);
		const value = {id: 42};
		const signed = await serializer.stringify(value);
		expect(await serializer.parse(signed, undefined, undefined, true)).toEqual([value, mockDate]);
	});
});
