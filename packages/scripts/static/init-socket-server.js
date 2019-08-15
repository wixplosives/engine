#!/usr/bin/env node

const { normalize, join } = require('path');

let inOwnRepo = __dirname.includes(normalize('/packages/scripts'));
let rootDir = inOwnRepo ? 'src' : 'cjs';
if (inOwnRepo) {
    require('@ts-tools/node/r');
}
require(join(__dirname, '..', rootDir, 'run-socket-server'));



