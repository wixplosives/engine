/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import type {Command} from 'commander';
import { resolve } from 'path';
import open from 'open';
import fs from '@file-services/node';

import { Application, parseCliArguments } from '@wixc3/engine-scripts';
import { startDevServer } from './utils';

const parseBoolean = (value: string) => value === 'true';
const collectMultiple = (val: string, prev: string[]) => [...prev, val];
const defaultPublicPath = process.env.ENGINE_PUBLIC_PATH || '/';

export type CliCommand = (program: Command) => void;

export class CliApplication {
    constructor(protected program: Command, commands: Iterable<CliCommand>) {
        for (const command of commands) {
            command(program);
        }
    }

    parse(argv: string[]) {
        this.program.parse(argv);
    }
}

export const startCommand: CliCommand = (program) =>
    program
        .command('start [path]')
        .option('-r, --require <path>', 'path to require before anything else', collectMultiple, [])
        .option('-f, --feature <feature>')
        .option('-c, --config <config>')
        .option('--mode <production|development>', 'mode passed to webpack', 'development')
        .option('--inspect')
        .option('-p ,--port <port>')
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
        .option('--favicon <faviconPath>', 'path to favicon to be displayed in browser environments')
        .option('--publicConfigsRoute <publicConfigsRoute>', 'public route for configurations')
        .option('--engineerEntry <engineerEntry>', 'entry feature for engineer', 'engineer/gui')
        .option('--webpackConfig <webpackConfig>', 'path to webpack config to build the engine with')
        .option('--webpackHot', 'Start dev server with webpackHot hot reloading', false)
        .option(
            '--nodeEnvironmentsMode <nodeEnvironmentsMode>',
            'one of "new-server", "same-server" or "forked" for choosing how to launch node envs'
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
                port: httpServerPort = 3000,
                singleFeature,
                open: openBrowser = 'true',
                require: pathsToRequire,
                publicPath = defaultPublicPath,
                mode,
                title,
                faviconPath,
                publicConfigsRoute,
                autoLaunch,
                engineerEntry,
                inspect,
                featureDiscoveryRoot,
                webpackConfig,
                webpackHot,
                nodeEnvironmentsMode,
            } = cmd;

            try {
                const basePath = resolve(path);
                const favicon = faviconPath ? resolve(basePath, faviconPath) : undefined;

                const { devServerFeature } = await startDevServer({
                    featureName,
                    configName,
                    httpServerPort,
                    singleFeature,
                    pathsToRequire,
                    publicPath,
                    mode,
                    title,
                    favicon,
                    publicConfigsRoute,
                    autoLaunch,
                    engineerEntry,
                    targetApplicationPath: fs.existsSync(path) ? fs.resolve(path) : process.cwd(),
                    runtimeOptions: parseCliArguments(process.argv.slice(3)),
                    inspect,
                    featureDiscoveryRoot,
                    webpackConfigPath: webpackConfig,
                    webpackHot,
                    nodeEnvironmentsMode,
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

export function buildCommand(program: Command) {
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
        .option('--favicon <faviconPath>', 'path to favicon to be displayed in browser environments')
        .option('--webpackConfig <webpackConfig>', 'path to webpack config to build the application with')
        .option('--publicConfigsRoute <publicConfigsRoute>', 'public route for configurations')
        .option('--external [true|false]', 'build feature as external', parseBoolean, false)
        .option('--eagerEntrypoints [true|false]', 'build feature as external', parseBoolean, false)
        .option(
            '--sourcesRoot <sourcesRoot>',
            'the directory where the feature library will be published at (relative to the base path). default: "."'
        )
        .option(
            '--staticExternalsDescriptor <staticExternalsDescriptor>',
            'relative to the output directory - a path to a json file which retrieves all external feature descriptors'
        )
        .option(
            '--includeExternalFeatures <includeExternalFeatures>',
            'should include defined external features in the built output',
            parseBoolean,
            false
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
                faviconPath,
                publicConfigsRoute,
                webpackConfig,
                external,
                sourcesRoot,
                eagerEntrypoints,
                featureDiscoveryRoot,
                staticExternalsDescriptor,
                includeExternalFeatures,
            } = cmd;
            try {
                const basePath = resolve(path);
                preRequire(pathsToRequire, basePath);
                const favicon = faviconPath ? resolve(basePath, faviconPath) : undefined;
                const outputPath = resolve(outDir);
                const app = new Application({ basePath, outputPath, featureDiscoveryRoot });
                const stats = await app.build({
                    featureName,
                    configName,
                    publicPath,
                    mode,
                    singleFeature,
                    title,
                    favicon,
                    publicConfigsRoute,
                    webpackConfigPath: webpackConfig,
                    external,
                    sourcesRoot,
                    staticExternalFeaturesFileName: staticExternalsDescriptor,
                    eagerEntrypoint: eagerEntrypoints,
                    includeExternalFeatures,
                });
                console.log(stats.toString('errors-warnings'));
            } catch (e) {
                printErrorAndExit(e);
            }
        });
}

export function runCommand(program: Command) {
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
export function cleanCommand(program: Command) {
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

export function createCommand(program: Command) {
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
