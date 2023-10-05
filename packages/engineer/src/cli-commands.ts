/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import { nodeFs as fs } from '@file-services/node';
import { createRequestResolver } from '@file-services/resolve';
import { parseCliArguments } from '@wixc3/engine-runtime-node';
import { Application } from '@wixc3/engine-scripts';
import type { Command } from 'commander';
import { resolve } from 'node:path';
import open from 'open';
import type { ServerListeningHandler } from './feature/dev-server.types.js';
import { startDevServer } from './utils.js';
import { pathToFileURL } from 'node:url';

const resolveRequest = createRequestResolver({ fs, conditions: ['node', 'import', 'require'] });
const parseBoolean = (value: string) => value === 'true';
const collectMultiple = (val: string, prev: string[]) => [...prev, val];
const defaultPublicPath = process.env.ENGINE_PUBLIC_PATH || '';

export type CliCommand = (program: Command) => void;

export class CliApplication {
    constructor(
        protected program: Command,
        commands: Iterable<CliCommand>,
    ) {
        for (const command of commands) {
            command(program);
        }
    }

    parse(argv: string[]) {
        this.program.parse(argv);
    }
}

const engineCommandBuilder = (program: Command, command: string): Command => {
    return program
        .command(command)
        .option('-r, --require <path>', 'path to require before anything else', collectMultiple, [])
        .option(
            '-f, --feature <feature>',
            `feature name is combined using the package name (without the scope (@) and "-feature" parts) and the feature name (file name) - e.g. packageName/featureName.
        featureName and packageName are the same then featureName is sufficient
    `,
        )
        .option(
            '-c, --config <config>',
            `config name is combined using the package name (without the scope (@) and "-feature" parts) and the feature name (file name) - e.g. packageName/featureName.
    `,
        )
        .option('--publicPath <path>', 'public path prefix to use as base', defaultPublicPath)
        .option('--inspect')
        .option('--singleFeature', 'build only the feature set by --feature', false)
        .option('--title <title>', 'application title to display in browser')
        .option('--favicon <faviconPath>', 'path to favicon to be displayed in browser environments')
        .option('--featureDiscoveryRoot <featureDiscoveryRoot>', 'package subdirectory where feature discovery starts');
};

export const startCommand: CliCommand = (program) =>
    engineCommandBuilder(program, 'start [path]')
        .option('--mode <production|development>', 'mode passed to webpack', 'development')
        .option('--inspect')
        .option('-p ,--port <port>')
        .option('--open <open>')
        .option(
            '--autoLaunch [autoLaunch]',
            'should auto launch node environments if feature name is provided',
            parseBoolean,
            true,
        )
        .option('--engineerEntry <engineerEntry>', 'entry feature for engineer', 'engineer/gui')
        .option('--webpackConfig <webpackConfig>', 'path to webpack config to build the engine with')
        .option(
            '--nodeEnvironmentsMode <nodeEnvironmentsMode>',
            'one of "new-server", "same-server" or "forked" for choosing how to launch node envs',
        )
        .option('--no-log', 'disable console logs')
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
                nodeEnvironmentsMode,
                log,
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
                    targetApplicationPath: fs.existsSync(path) ? resolve(path) : process.cwd(),
                    runtimeOptions: parseCliArguments(process.argv.slice(3)),
                    inspect,
                    featureDiscoveryRoot,
                    webpackConfigPath: webpackConfig,
                    nodeEnvironmentsMode,
                    log,
                });

                const { port } = await new Promise((resolve: ServerListeningHandler) => {
                    devServerFeature.serverListeningHandlerSlot.register(resolve);
                });

                if (!process.send && featureName && configName && openBrowser === 'true') {
                    await open(`http://localhost:${port}/main.html`);
                }
            } catch (e) {
                printErrorAndExit(e);
            }
        });

export function buildCommand(program: Command) {
    engineCommandBuilder(program, 'build [path]')
        .option('--mode <production|development>', 'mode passed to webpack', 'production')
        .option('--outDir <outDir>', 'output directory for the built application', 'dist-app')
        .option('--webpackConfig <webpackConfig>', 'path to webpack config to build the application with')
        .option('--publicConfigsRoute <publicConfigsRoute>', 'public route for configurations')
        .option('--eagerEntrypoints [true|false]', 'bundle environments into a single bundle', parseBoolean, false)
        .option('--publicPathVariableName <publicPathVariableName>', 'global variable name which stores public path')
        .option(
            '--configLoaderModuleName [configLoaderModuleName]',
            'custom config loader module name. used for static builds only',
        )
        .option(
            '--sourcesRoot <sourcesRoot>',
            'the directory where the feature library will be published at (relative to the base path). default: "."',
        )
        .allowUnknownOption(true)
        .action(async (path = process.cwd(), cmd: Record<string, any>) => {
            const {
                feature: featureName,
                config: configName,
                outDir,
                require: pathsToRequire,
                publicPath,
                publicPathVariableName,
                mode,
                singleFeature,
                title,
                faviconPath,
                publicConfigsRoute,
                webpackConfig,
                sourcesRoot,
                eagerEntrypoints,
                featureDiscoveryRoot,
                configLoaderModuleName,
            } = cmd;
            try {
                const basePath = resolve(path);
                await preRequire(pathsToRequire, basePath);
                const favicon = faviconPath ? resolve(basePath, faviconPath) : undefined;
                const outputPath = resolve(outDir);
                const app = new Application({ basePath, outputPath });
                const { stats } = await app.build({
                    featureName,
                    configName,
                    featureDiscoveryRoot,
                    publicPath,
                    publicPathVariableName,
                    mode,
                    singleFeature,
                    title,
                    favicon,
                    publicConfigsRoute,
                    webpackConfigPath: webpackConfig,
                    sourcesRoot,
                    eagerEntrypoint: eagerEntrypoints,
                    configLoaderModuleName,
                });
                console.log(stats.toString('errors-warnings'));
            } catch (e) {
                printErrorAndExit(e);
            }
        });
}

export function runCommand(program: Command) {
    engineCommandBuilder(program, 'run [path]')
        .option('--outDir <outDir>')
        .option('-p ,--port <port>')
        .option(
            '--autoLaunch <autoLaunch>',
            'should auto launch node environments if feature name is provided',
            (param) => param === 'true',
            true,
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
                await preRequire(pathsToRequire, basePath);
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

async function preRequire(pathsToRequire: string[], basePath: string) {
    for (const request of pathsToRequire) {
        const { resolvedFile } = resolveRequest(basePath, request);
        if (!resolvedFile) {
            throw new Error(`Cannot resolve "${request}"`);
        }
        await import(pathToFileURL(resolvedFile).href);
    }
}

function printErrorAndExit(message: unknown) {
    console.error(message);
    process.exit(1);
}
