#!/usr/bin/env node

const { normalize, join } = require('path');

const inOwnRepo = __filename.endsWith(normalize('packages/scripts/static/init-remote-environment.js'));

if (inOwnRepo) {
    require('@ts-tools/node/r');
}

require(join(__dirname, '..', inOwnRepo ? 'src' : 'cjs', 'remote-process-environment'));
