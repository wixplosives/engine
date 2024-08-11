import { fixupPluginRules } from '@eslint/compat';
import pluginJs from '@eslint/js';
import configPrettier from 'eslint-config-prettier';
import pluginNoOnlyTests from 'eslint-plugin-no-only-tests';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginTypescript from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
    { ignores: ['**/dist/', '**/dist-engine/', '**/*.{js,mjs,cjs}', 'packages/engineer/gui-feature.d.ts'] },
    pluginJs.configs.recommended,

    ...pluginTypescript.configs.recommendedTypeChecked,
    { languageOptions: { parserOptions: { projectService: true } } },

    pluginReact.configs.flat.recommended,
    // pluginReact.configs.flat['jsx-runtime'],
    { settings: { react: { version: 'detect' } } },

    {
        plugins: {
            'react-hooks': pluginReactHooks,
            'no-only-tests': fixupPluginRules(pluginNoOnlyTests),
        },
    },
    configPrettier,

    {
        rules: {
            // "no-console": "error",
            'no-empty-pattern': 'off',
            'react/prop-types': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
            'no-only-tests/no-only-tests': 'error',

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
];
