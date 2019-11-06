#!/usr/bin/env node

const { normalize } = require('path');
if (__dirname.endsWith(normalize('/packages/scripts'))) {
    require('@ts-tools/node/r');
    require('tsconfig-paths/register');
    require('./src/cli');
} else {
    require('./cjs/cli');
}
