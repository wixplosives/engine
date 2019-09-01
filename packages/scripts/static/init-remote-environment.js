#!/usr/bin/env node

const { normalize, join } = require('path');

const inOwnRepo = __dirname.includes(normalize('/packages/scripts'));

if (inOwnRepo) {
    require('@ts-tools/node/r');
}

require(join(__dirname, '..', inOwnRepo ? 'src' : 'cjs', 'run-node-environment'));
