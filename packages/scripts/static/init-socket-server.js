#!/usr/bin/env node

const { normalize, join } = require('path');

if (__dirname.includes(normalize('/packages/scripts'))) {
    require('@ts-tools/node/r');
    require(join(__dirname, '..', 'src/run-socket-server'));
} else {
    require(join(__dirname, '..', 'cjs/run-socket-server'));
}



