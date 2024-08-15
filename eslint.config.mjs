import { fixupPluginRules } from '@eslint/compat';
import pluginJs from '@eslint/js';
import configPrettier from 'eslint-config-prettier';
import pluginNoOnlyTests from 'eslint-plugin-no-only-tests';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginTypescript from 'typescript-eslint';

for (const config of pluginTypescript.configs.recommendedTypeChecked) {
    config.files = ['**/*.{ts,tsx,mts,cts}']; // ensure config only targets TypeScript files
}

/** @type {import('eslint').Linter.Config[]} */
export default [
    { ignores: ['**/dist/', '**/dist-engine/', 'packages/engineer/gui-feature.d.ts'] },
    pluginJs.configs.recommended,
    pluginReact.configs.flat.recommended,
    // pluginReact.configs.flat['jsx-runtime'],
    { settings: { react: { version: 'detect' } } },
    {
        plugins: {
            'react-hooks': pluginReactHooks,
            'no-only-tests': fixupPluginRules(pluginNoOnlyTests),
        },
    },
    {
        rules: {
            // 'no-console': 'error',
            'no-empty-pattern': 'off',
            'no-only-tests/no-only-tests': 'error',
            'no-undef': 'off',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'react/prop-types': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
        },
    },
    ...pluginTypescript.configs.recommendedTypeChecked,
    { languageOptions: { parserOptions: { projectService: true } } },
    {
        files: ['**/*.{ts,tsx,mts,cts}'],
        rules: {
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/unbound-method': 'off',
        },
    },
    configPrettier,
];
