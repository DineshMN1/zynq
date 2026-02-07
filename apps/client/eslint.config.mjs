import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = tseslint.config(
  // Next.js core rules (React, hooks, core-web-vitals)
  ...compat.config({
    extends: ['next/core-web-vitals'],
  }),
  // TypeScript rules via typescript-eslint v8 (ESLint 9 native)
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);

export default eslintConfig;
