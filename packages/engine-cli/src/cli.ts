import { parseArgs } from 'node:util';
import { runEngine } from './engine-build';

function parseCliArgs() {
    const { values: args } = parseArgs({
        strict: false,
        allowPositionals: false,
    });
    return new Map(Object.entries(args));
}

const args = parseCliArgs();
const buildTargets = (args.get('buildTargets') as 'node' | 'web' | 'both') ?? 'both';
const clean = Boolean(args.get('clean')) ?? true;
const watch = Boolean(args.get('watch')) ?? false;
const dev = Boolean(args.get('dev')) ?? watch;
const run = Boolean(args.get('run')) ?? dev;
const feature = String(args.get('feature'));
const config = String(args.get('config'));
const publicPath = String(args.get('publicPath')) ?? '';
const verbose = Boolean(args.get('verbose')) ?? false;
const engineConfigFilePath = String(args.get('engineConfigFilePath'));

runEngine({ engineConfigFilePath, verbose, clean, dev, watch, publicPath, buildTargets, feature, config, run }).catch(
    (e) => {
        console.error(e);
        process.exitCode = 1;
    },
);
