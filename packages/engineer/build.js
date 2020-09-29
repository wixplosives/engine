#!/usr/bin/env node
const { dirname } = require('path');

const configFilePath = require.resolve('../../tsconfig.json');
const { createNodeExtension } = require('@ts-tools/node');
const nodeExtension = createNodeExtension({ configFilePath });
require.extensions['.ts'] = nodeExtension;
require.extensions['.tsx'] = nodeExtension;

const { options: tsconfigPathsOptions } = require('tsconfig-paths/lib/options');
tsconfigPathsOptions.cwd = dirname(configFilePath);
require('tsconfig-paths/register');
require('./scripts/build');
