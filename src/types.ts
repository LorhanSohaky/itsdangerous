/**
 * A type representing data that can be either a string or a Uint8Array. This is
 * commonly used for buffers that can be stored or transmitted as text or binary
 * data.
 */
export type StringBuffer = string | Uint8Array;

/**
 * A type representing a secret key used for cryptographic operations. The
 * secret key can be either a single StringBuffer or an iterable collection of
 * StringBuffers. This flexibility allows for key rotation and multiple key
 * management.
 */
export type SecretKey = Iterable<StringBuffer> | StringBuffer;

/**
 * A placeholder type representing a value that could be of any type. This type
 * is intended to be replaced with a more specific type as the codebase evolves.
 *
 * @note This type is used to temporarily suppress TypeScript errors where a
 * more specific type definition is not yet available. As the code matures, it
 * is important to refine this type to ensure type safety and clarity.
 */
// biome-ignore lint/suspicious/noExplicitAny: Used as a temporary placeholder type
export type $TsFixMe = any;
