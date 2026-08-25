import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'src/legacy/**', 'e2e/**', 'public/**'],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
];
