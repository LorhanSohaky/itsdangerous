import {Constructable, expect} from 'vitest';

export function withThrows<T extends Constructable>(fn: () => void, error: T): InstanceType<T> {
  let thrownError: InstanceType<T> | undefined;
  try {
    fn();
  } catch (error) {
    thrownError = error as InstanceType<T>;
  }
  expect(thrownError).toBeInstanceOf(error);
  return thrownError as InstanceType<T>;
}
