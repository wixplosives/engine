import { parseArgs } from 'node:util';
import { engineBuild } from './engine-build';

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
const featureName = args.get('feature') as string;
const configName = args.get('config') as string;

console.log('Cli run', args);

engineBuild({ dev: { enabled: watch, buildTargets, clean }, configName, featureName }).catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
