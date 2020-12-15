/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import program from 'commander';
import open from 'open';
import fs from '@file-services/node';
import {
    parseCliArguments,
    cleanCommand,
    buildCommand,
    runCommand,
    createCommand,
    remoteCommand,
    CliApplication,
    Command,
} from '@wixc3/engine-scripts';

import { startDevServer } from './utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
program.version((require('../package.json') as { version: string }).version);

const parseBoolean = (value: string) => value === 'true';
const collectMultiple = (val: string, prev: string[]) => [...prev, val];
const defaultPublicPath = process.env.ENGINE_PUBLIC_PATH || '/';

const startCommand: Command = (program) =>
    program
        .command('start [path]')
        .option('-r, --require <path>', 'path to require before anything else', collectMultiple, [])
        .option('-f, --feature <feature>')
        .option('-c, --config <config>')
        .option('--mode <production|development>', 'mode passed to webpack', 'development')
        .option('--inspect')
        .option('-p ,--port <port>')
        .option('--singleRun', 'when enabled, webpack will not watch files', false)
        .option('--singleFeature', 'build only the feature set by --feature', false)
        .option('--publicPath <path>', 'public path prefix to use as base', defaultPublicPath)
        .option('--open <open>')
        .option(
            '--autoLaunch [autoLaunch]',
            'should auto launch node environments if feature name is provided',
            parseBoolean,
            true
        )
        .option('--title <title>', 'application title to display in browser')
        .option('--publicConfigsRoute <publicConfigsRoute>', 'public route for configurations')
        .option('--engineerEntry <engineerEntry>', 'entry feature for engineer', 'engineer/gui')
        .option('--webpackConfig <webpackConfig>', 'path to webpack config to build the engine with')
        .option(
            '--featureDiscoveryRoot <featureDiscoveryRoot>',
            'package subdirectory where feature discovery starts',
            '.'
        )
        .allowUnknownOption(true)
        .action(async (path = process.cwd(), cmd: Record<string, any>) => {
            const {
                feature: featureName,
                config: configName,
                port: httpServerPort = 3000,
                singleRun,
                singleFeature,
                open: openBrowser = 'true',
                require: pathsToRequire,
                publicPath = defaultPublicPath,
                mode,
                title,
                publicConfigsRoute,
                autoLaunch,
                engineerEntry,
                inspect,
                featureDiscoveryRoot,
                webpackConfig,
            } = cmd;

            try {
                const { devServerFeature } = await startDevServer({
                    featureName,
                    configName,
                    httpServerPort,
                    singleRun,
                    singleFeature,
                    pathsToRequire,
                    publicPath,
                    mode,
                    title,
                    publicConfigsRoute,
                    autoLaunch,
                    engineerEntry,
                    targetApplicationPath: fs.existsSync(path) ? fs.resolve(path) : process.cwd(),
                    runtimeOptions: parseCliArguments(process.argv.slice(3)),
                    inspect,
                    featureDiscoveryRoot,
                    webpackConfigPath: webpackConfig,
                });

                const { port } = await new Promise((resolve) => {
                    devServerFeature.serverListeningHandlerSlot.register(resolve);
                });

                if (!process.send && featureName && configName && openBrowser === 'true') {
                    await open(`http://localhost:${port as string}/main.html`);
                }
            } catch (e) {
                printErrorAndExit(e);
            }
        });

const cliApplication = new CliApplication(program, [
    startCommand,
    buildCommand,
    createCommand,
    runCommand,
    remoteCommand,
    cleanCommand,
]);

cliApplication.parse(process.argv);

function printErrorAndExit(message: unknown) {
    console.error(message);
    process.exitCode = 1;
}
