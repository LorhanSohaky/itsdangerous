/**
 * A type that can be either a string or a Uint8Array.
 */
export type StringBuffer = string | Uint8Array;

/**
 * A type representing a secret key, which can be an iterable of StringBuffers
 * or a single StringBuffer.
 */
export type SecretKey = Iterable<StringBuffer> | StringBuffer;

/**
 * A placeholder type to be fixed with a more specific type definition in the
 * future.
 * @note This type is used to suppress TypeScript errors and should be replaced
 * with a specific type as the code evolves.
 */
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type $TsFixMe = any;
