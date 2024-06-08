import type {$TsFixMe} from '../src/types.ts';

type Constructable<T extends Error> = new (..._arguments_: $TsFixMe[]) => T;

export async function withThrows<T extends Error>(
	function_: () => Promise<$TsFixMe>,
	ErrorType: Constructable<T>,
): Promise<T> {
	let thrownError: unknown;
	try {
		await function_();
	} catch (error) {
		thrownError = error;
		if (thrownError instanceof ErrorType) {
			return thrownError;
		}

		throw new TypeError(`Thrown error is not an instance of the expected type: ${ErrorType.name}`);
	}

	throw new Error('Expected function to throw an error, but it did not.');
}
