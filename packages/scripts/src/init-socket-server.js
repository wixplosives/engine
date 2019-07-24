#!/usr/bin/env node

const { normalize, join } = require('path');

if (__dirname.includes(normalize('/packages/scripts'))) {
    require('@ts-tools/node/r');
}

require(join(__dirname, './run-socket-server'));

