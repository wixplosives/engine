import { loadEngineConfig, runEngine, parseCliArgs } from './engine-build';

async function engine() {
    const args = parseCliArgs();
    const buildTargets = (args.get('buildTargets') as 'node' | 'web' | 'both') ?? 'both';
    const help = boolParam(args.has('help')) ?? false;
    const clean = boolParam(args.get('clean')) ?? true;
    const watch = boolParam(args.get('watch')) ?? false;
    const dev = boolParam(args.get('dev')) ?? watch;
    const run = boolParam(args.get('run')) ?? dev;
    const forceAnalyze = boolParam(args.get('forceAnalyze')) ?? !dev;
    const verbose = boolParam(args.get('verbose')) ?? false;
    const writeMetadataFiles = boolParam(args.get('writeMetadataFiles')) ?? true;

    const runtimeArgs = JSON.parse(strParam(args.get('runtimeArgs')) ?? '{}');
    const feature = strParam(args.get('feature'));
    const config = strParam(args.get('config'));
    const publicPath = strParam(args.get('publicPath')) ?? '';
    const engineConfigFilePath = strParam(args.get('engineConfigFilePath'));
    const publicConfigsRoute = strParam(args.get('publicConfigsRoute')) ?? 'configs';
    const configLoadingMode =
        enumParam<'fresh' | 'watch' | 'require'>(args.get('configLoadingMode'), ['fresh', 'watch', 'require']) ??
        (watch ? 'watch' : 'require');

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
        forceAnalyze,
        publicPath,
        buildTargets,
        feature,
        config,
        run,
        writeMetadataFiles,
        publicConfigsRoute,
        configLoadingMode,
    });
}

function strParam(param: string | boolean | undefined) {
    return param !== undefined ? String(param) : undefined;
}

function enumParam<T>(param: string | boolean | undefined, options: string[]): T | undefined {
    const sParam = param !== undefined ? (String(param) as T) : undefined;
    if (typeof sParam === 'string' && !options.includes(sParam)) {
        throw new Error(`Invalid option: ${sParam}. Options are: ${options.join(', ')}`);
    }
    return sParam;
}

function boolParam(param: string | boolean | undefined) {
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
