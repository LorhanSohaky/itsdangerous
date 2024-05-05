import eslint from '@eslint/js';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  eslint.configs.recommended,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  eslintPluginUnicorn.configs['flat/all'],
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', {allowNumber: true}],
      'no-unused-vars': 'off',
      'object-shorthand': 'error',
      'unicorn/no-empty-file': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prefer-math-trunc': 'off',
      'unicorn/prevent-abbreviations': 'off',
    },
  },
);
