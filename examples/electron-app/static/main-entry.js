#!/usr/bin/env node

const { normalize } = require('path');

if (__dirname.includes(normalize('/examples/electron-app'))) {
    require('@ts-tools/node/r');
    require('tsconfig-paths/register')
}
require('../src/main-entry');
