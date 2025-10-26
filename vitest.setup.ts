// biome-ignore lint/correctness/noNodejsModules: needed for cryptography
import crypto from 'node:crypto';

Object.defineProperty(global, 'crypto', {
	value: crypto,
	configurable: true,
});
