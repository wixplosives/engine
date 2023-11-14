#!/usr/bin/env node

const { resolveExecArgv } = require('@wixc3/engine-scripts');
const { once } = require('node:events');
const { Worker } = require('node:worker_threads');

(async () => {
    const basePath = process.cwd();
    const execArgv = await resolveExecArgv(basePath);
    const worker = new Worker(require.resolve('../dist/cli.js'), {
        argv: process.argv.slice(2),
        execArgv,
    });
    const [code] = await once(worker, 'exit');
    process.exit(code);
})().catch((err) => {
    console.log(err);
    process.exit(1);
});
