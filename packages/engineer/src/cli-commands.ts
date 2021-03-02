/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import type commander from 'commander';
import { resolve } from 'path';
import open from 'open';
import fs from '@file-services/node';

import { Application, parseCliArguments } from '@wixc3/engine-scripts';
import { startDevServer } from './utils';
// eslint-disable-next-line @typescript-eslint/no-var-requires

const parseBoolean = (value: string) => value === 'true';
const collectMultiple = (val: string, prev: string[]) => [...prev, val];
const defaultPublicPath = process.env.ENGINE_PUBLIC_PATH || '/';

export type Command = (program: typeof commander) => void;

export class CliApplication {
    constructor(protected program: typeof commander, commands: Iterable<Command>) {
        for (const command of commands) {
            command(program);
        }
    }

    parse(argv: string[]) {
        this.program.parse(argv);
    }
}

export const startCommand: Command = (program) =>
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

export function buildCommand(program: typeof commander) {
    program
        .command('build [path]')
        .option('-r, --require <path>', 'path to require before anything else', collectMultiple, [])
        .option('-f ,--feature <feature>')
        .option('-c ,--config <config>')
        .option('--mode <production|development>', 'mode passed to webpack', 'production')
        .option('--outDir <outDir>', 'default: dist')
        .option('--publicPath <path>', 'public path prefix to use as base', defaultPublicPath)
        .option('--singleFeature [true|false]', 'build only the feature set by --feature', parseBoolean, true)
        .option('--title <title>', 'application title to display in browser')
        .option('--webpackConfig <webpackConfig>', 'path to webpack config to build the application with')
        .option('--publicConfigsRoute <publicConfigsRoute>', 'public route for configurations')
        .option('--external [true|false]', 'build feature as external', parseBoolean, false)
        .option('--eagerEntrypoints [true|false]', 'build feature as external', parseBoolean, false)
        .option(
            '--featureOutDir <featureOutDir>',
            'the directory where the feature library will be published at (relative to the base path). default: "."'
        )
        .option(
            '--withExternalFeatures [true|false]',
            'include defined external features in the output',
            parseBoolean,
            false
        )
        .option(
            '--fetchExternalFeatures [true|false]',
            'fetch for receiving external features in the output application',
            parseBoolean,
            true
        )
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
                outDir = 'dist',
                require: pathsToRequire,
                publicPath,
                mode,
                singleFeature,
                title,
                publicConfigsRoute,
                webpackConfig,
                external,
                featureOutDir,
                withExternalFeatures,
                fetchExternalFeatures,
                eagerEntrypoints,
                featureDiscoveryRoot,
            } = cmd;
            try {
                const basePath = resolve(path);
                preRequire(pathsToRequire, basePath);
                const outputPath = resolve(outDir);
                const app = new Application({ basePath, outputPath, featureDiscoveryRoot });
                const stats = await app.build({
                    featureName,
                    configName,
                    publicPath,
                    mode,
                    singleFeature,
                    title,
                    publicConfigsRoute,
                    webpackConfigPath: webpackConfig,
                    external,
                    featureOutDir,
                    withExternalFeatures,
                    fetchExternalFeatures,
                    eagerEntrypoint: eagerEntrypoints,
                });
                console.log(stats.toString('errors-warnings'));
            } catch (e) {
                printErrorAndExit(e);
            }
        });
}

export function runCommand(program: typeof commander) {
    program
        .command('run [path]')
        .option('-r, --require <path>', 'path to require before anything else', collectMultiple, [])
        .option('-c ,--config <config>')
        .option('-f ,--feature <feature>')
        .option('--outDir <outDir>')
        .option('--publicPath <path>', 'public path prefix to use as base', defaultPublicPath)
        .option('-p ,--port <port>')
        .option(
            '--autoLaunch <autoLaunch>',
            'should auto launch node environments if feature name is provided',
            (param) => param === 'true',
            true
        )
        .option('--publicConfigsRoute <publicConfigsRoute>', 'public route for configurations')
        .allowUnknownOption(true)
        .action(async (path = process.cwd(), cmd: Record<string, any>) => {
            const {
                config: configName,
                outDir = 'dist',
                feature: featureName,
                port: preferredPort,
                require: pathsToRequire,
                publicPath,
                autoLaunch,
                publicConfigsRoute,
            } = cmd;
            try {
                const basePath = resolve(path);
                preRequire(pathsToRequire, basePath);
                const outputPath = resolve(outDir);
                const app = new Application({ basePath, outputPath });
                const { port } = await app.run({
                    configName,
                    featureName,
                    runtimeOptions: parseCliArguments(process.argv.slice(3)),
                    port: preferredPort ? parseInt(preferredPort, 10) : undefined,
                    publicPath,
                    autoLaunch,
                    publicConfigsRoute,
                });
                console.log(`Listening:`);
                console.log(`http://localhost:${port}/main.html`);
            } catch (e) {
                printErrorAndExit(e);
            }
        });
}
export function cleanCommand(program: typeof commander) {
    program.command('clean [path]').action(async (path = process.cwd()) => {
        try {
            const basePath = resolve(path);
            const app = new Application({ basePath });
            console.log(`Removing: ${app.outputPath}`);
            await app.clean();
        } catch (e) {
            printErrorAndExit(e);
        }
    });
}

export function createCommand(program: typeof commander) {
    program
        .command('create [featureName]')
        .option('--path <path>')
        .option('--featuresDir <featuresDir>', 'path to the features directory in the project (optional)')
        .option('--templatesDir <templatesDir>', 'path to a customized templates folder (optional)')
        .action(async (featureName, { path = process.cwd(), templatesDir, featuresDir }) => {
            try {
                const basePath = resolve(path);
                const app = new Application({ basePath });
                await app.create({ featureName, templatesDir, featuresDir });
            } catch (e) {
                printErrorAndExit(e);
            }
        });
}

function preRequire(pathsToRequire: string[], basePath: string) {
    for (const request of pathsToRequire) {
        const resolvedRequest = require.resolve(request, { paths: [basePath] });
        require(resolvedRequest);
    }
}

function printErrorAndExit(message: unknown) {
    console.error(message);
    process.exit(1);
}
