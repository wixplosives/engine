#!/usr/bin/env node

const { Plop, run } = require('plop');
const plopfile = __dirname + '/plopfile.js';

Plop.launch({
	configPath: plopfile
}, run);