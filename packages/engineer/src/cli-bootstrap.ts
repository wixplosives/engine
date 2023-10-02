import { resolveExecArgv } from '@wixc3/engine-scripts';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';

(async () => {
    const basePath = process.cwd();
    const execArgv = await resolveExecArgv(basePath);

    const worker = new Worker(require.resolve('./cli.js'), {
        argv: process.argv.slice(2),
        execArgv,
    });
    const [code] = await once(worker, 'exit');
    process.exit(code);
})().catch((err) => {
    console.log(err);
    process.exit(1);
});
