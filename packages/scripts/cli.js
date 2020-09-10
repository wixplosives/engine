#!/usr/bin/env node

try {
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
} catch (e) {
    /*
        This is our way to keep backward compatibility for engine scrtips
        Since all the new engineer commands are registered under 'engineer'
        and I don't want cli.ts here to be aware of engineer implementation details
        So if there is an error I just fallback to try and find the command in engineer
    */
    if (e.code === 'commander.unknownCommand') {
        require('@wixc3/engineer/cli');
    }
}
