import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['apps/**/*.ts', 'packages/**/*.ts'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', { paths: [{ name: 'pg', message: 'Only Database may access PostgreSQL.' }] }],
    },
  },
  { files: ['packages/database/src/Database.ts'], rules: { 'no-restricted-imports': 'off' } },
);
