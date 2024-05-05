// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructable<T extends Error> = new (...args: any[]) => T;

export function withThrows<T extends Error>(fn: () => void, ErrorType: Constructable<T>): T {
  let thrownError: unknown;
  try {
    fn();
  } catch (error) {
    thrownError = error;
    if (thrownError instanceof ErrorType) {
      return thrownError;
    } else {
      throw new TypeError(`Thrown error is not an instance of the expected type: ${ErrorType.name}`);
    }
  }
  throw new Error('Expected function to throw an error, but it did not.');
}
