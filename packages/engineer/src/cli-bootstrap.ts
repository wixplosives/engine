import { resolveExecArgv } from '@wixc3/engine-scripts';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';

(async () => {
    const basePath = process.cwd();
    const execArgv = await resolveExecArgv(basePath);

    const require = createRequire(import.meta.url);
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
