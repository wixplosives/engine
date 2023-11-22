import { loadEngineConfig, runEngine, parseCliArgs } from './engine-build';

async function engine() {
    const args = parseCliArgs();
    const buildTargets = (args.get('buildTargets') as 'node' | 'web' | 'both') ?? 'both';
    const help = boolParam(args.has('help')) ?? false;
    const clean = boolParam(args.get('clean')) ?? true;
    const watch = boolParam(args.get('watch')) ?? false;
    const dev = boolParam(args.get('dev')) ?? watch;
    const run = boolParam(args.get('run')) ?? dev;
    const verbose = boolParam(args.get('verbose')) ?? false;
    const feature = strParam(args.get('feature'));
    const config = strParam(args.get('config'));
    const publicPath = strParam(args.get('publicPath')) ?? '';
    const engineConfigFilePath = strParam(args.get('engineConfigFilePath'));
    if (help) {
        console.log(engine.toString());
        console.log('🤷‍♂️');
    }

    const engineConfig = await loadEngineConfig(process.cwd(), engineConfigFilePath);
    await runEngine({ engineConfig, verbose, clean, dev, watch, publicPath, buildTargets, feature, config, run });
}

function strParam(param?: string | boolean) {
    return param !== undefined ? String(param) : undefined;
}
function boolParam(param?: string | boolean) {
    return param !== undefined ? Boolean(param) : undefined;
}

engine().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
