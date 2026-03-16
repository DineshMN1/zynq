import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const eslintConfig = tseslint.config(...tseslint.configs.recommended, {
  plugins: {
    'react-hooks': reactHooks,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-expressions': [
      'error',
      { allowShortCircuit: true, allowTernary: true },
    ],
    'react-hooks/exhaustive-deps': 'warn',
    // v7 rules too strict for this codebase — these flag legitimate patterns:
    // set-state-in-effect: reading external state (DOM/localStorage) then syncing
    // purity: Math.random in useMemo, which is intentionally non-deterministic
    // static-components: returning existing component refs from helper functions
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/static-components': 'off',
  },
});

export default eslintConfig;
