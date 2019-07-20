#!/usr/bin/env node

const { normalize } = require('path');

if (__dirname.includes(normalize('/packages/scripts'))) {
    require('@ts-tools/node/r');
    require('./src/cli');
} else {
    require('./cjs/cli');
}

