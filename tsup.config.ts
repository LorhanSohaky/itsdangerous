import {defineConfig} from 'tsup';

export default defineConfig({
	clean: true,
	dts: true,
	entryPoints: ['src/index.ts'],
	format: ['esm'],
	target: 'esnext',
});
