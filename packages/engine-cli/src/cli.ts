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
    const writeMetadataFiles = boolParam(args.get('writeMetadataFiles')) ?? !watch;

    const runtimeArgs = JSON.parse(strParam(args.get('runtimeArgs')) ?? '{}');
    const feature = strParam(args.get('feature'));
    const config = strParam(args.get('config'));
    const publicPath = strParam(args.get('publicPath')) ?? '';
    const engineConfigFilePath = strParam(args.get('engineConfigFilePath'));
    const publicConfigsRoute = strParam(args.get('publicConfigsRoute')) ?? 'configs';

    if (help) {
        console.log(engine.toString());
        console.log('🤷‍♂️');
        return;
    }

    const engineConfig = await loadEngineConfig(process.cwd(), engineConfigFilePath);

    await runEngine({
        runtimeArgs,
        engineConfig,
        verbose,
        clean,
        dev,
        watch,
        publicPath,
        buildTargets,
        feature,
        config,
        run,
        writeMetadataFiles,
        publicConfigsRoute,
    });
}

function strParam(param?: string | boolean | undefined) {
    return param !== undefined ? String(param) : undefined;
}

function boolParam(param?: string | boolean | undefined) {
    if (param === undefined || typeof param === 'boolean') {
        return param;
    }
    if (param === 'true') {
        return true;
    }
    if (param === 'false') {
        return false;
    }
    throw new Error(`Invalid boolean parameter: ${param}`);
}

engine().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
