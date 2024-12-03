#!/usr/bin/env node

import { resolveExecArgv } from '@wixc3/engine-scripts';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';

const basePath = process.cwd();
const execArgv = await resolveExecArgv(basePath);
const worker = new Worker(new URL('../dist/cli.js', import.meta.url), {
    argv: process.argv.slice(2),
    execArgv,
});
const [code] = await once(worker, 'exit');
process.exit(code);
