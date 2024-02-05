# @wixc3/engine-cli

This package provides a command line interface for the engine.

## Installation

```bash
npm install @wixc3/engine-cli
```

## Usage

This package exposes an `engine` command that can be used to start the engine.

```bash
npx engine --watch
```

This will start the engine in watch mode, and open the dev server for the engine dashboard.

## Options

```ts
async function engine() {
  const args = parseCliArgs();
  const buildTargets = (args.get('buildTargets') as 'node' | 'web' | 'both') ?? 'both';
  const help = boolParam(args.has('help')) ?? false;
  const clean = boolParam(args.get('clean')) ?? true;
  const watch = boolParam(args.get('watch')) ?? false;
  const dev = boolParam(args.get('dev')) ?? watch;
  const run = boolParam(args.get('run')) ?? dev;
  const verbose = boolParam(args.get('verbose')) ?? false;
  const writeMetadataFiles = boolParam(args.get('writeMetadataFiles')) ?? true;

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
```
