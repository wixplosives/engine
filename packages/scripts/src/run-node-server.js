#!/usr/bin/env node

const { normalize } = require('path');

if (__dirname.includes(normalize('/packages/scripts'))) {
    require('@ts-tools/node/r');
    require('./environment-socket-server');
} else {
    require('./cjs/environment-socket-server');
}

