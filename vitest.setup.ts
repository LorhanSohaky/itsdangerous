// biome-ignore lint/correctness/noNodejsModules: <explanation>
import crypto from 'node:crypto';

Object.defineProperty(global, 'crypto', {
	value: crypto,
	configurable: true,
});
