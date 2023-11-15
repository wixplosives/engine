import { loadEngineConfig, runEngine, parseCliArgs } from './engine-build';

async function engine() {
    const args = parseCliArgs();
    const help = Boolean(args.has('help')) ?? false;
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

    if (help) {
        console.log(engine.toString());
        console.log('🤷‍♂️');
    }

    const engineConfig = await loadEngineConfig(engineConfigFilePath, process.cwd(), {});
    await runEngine({ engineConfig, verbose, clean, dev, watch, publicPath, buildTargets, feature, config, run });
}

engine().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
