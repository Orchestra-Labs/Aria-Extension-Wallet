module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    // project: ['./tsconfig.json'],
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:prettier/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  plugins: [
    'react',
    'react-hooks',
    'prettier',
    '@typescript-eslint',
    'simple-import-sort',
    'import',
    'react-refresh',
    'unused-imports'
  ],
  ignorePatterns: ['dist'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    "no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        "vars": "all",
        "varsIgnorePattern": "^_",
        "args": "after-used",
        "argsIgnorePattern": "^_",
      },
    ],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/prop-types': 'off',
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-no-useless-fragment': ['warn', { allowSingleChild: true }],
    '@typescript-eslint/no-empty-interface': 'off',
    'import/prefer-default-export': 'off',
    'no-plusplus': 'off',
    'no-restricted-syntax': 'warn',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
    'no-param-reassign': 'off',
    'react/require-default-props': 'off',
    'react/function-component-definition': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/no-unused-prop-types': 'warn',
    'react/display-name': 'off',
    'import/no-cycle': 'off',
    'react/self-closing-comp': 'warn',
  },
  settings: {
    react: {
      version: 'detect'
    },
    'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      node: {
        paths: ['node_modules', 'src'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
      'eslint-import-resolver-custom-alias': {
        alias: {
          '@': 'src',
        },
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  }
}
