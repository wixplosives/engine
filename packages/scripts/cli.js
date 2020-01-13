#!/usr/bin/env node

const { normalize, dirname } = require('path');
if (__dirname.endsWith(normalize('/packages/scripts'))) {
    const configFilePath = require.resolve('../../tsconfig.json');
    const { createNodeExtension } = require('@ts-tools/node');
    const nodeExtension = createNodeExtension({ configFilePath });
    require.extensions['.ts'] = nodeExtension;
    require.extensions['.tsx'] = nodeExtension;

    const { options: tsconfigPathsOptions } = require('tsconfig-paths/lib/options');
    tsconfigPathsOptions.cwd = dirname(configFilePath);
    require('tsconfig-paths/register');
    require('./src/cli');
} else {
    require('./cjs/cli');
}
