/* eslint-disable @typescript-eslint/no-misused-promises */

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import program from 'commander';
import { resolve } from 'path';
import open from 'open';

import { version } from '../package.json';
import { Application, IFeatureTarget } from './application';
import { IFeatureMessage, IPortMessage, IProcessMessage } from './types';
import { resolveFrom, parseCliArguments } from './utils';

program.version(version);

const collectMultiple = (val: string, prev: string[]) => [...prev, val];
const preRequireParams = ['-r, --require <path>', 'path to require before anything else', collectMultiple, []] as const;
const defaultPublicPath = process.env.ENGINE_PUBLIC_PATH || '/';

program
    .command('start [path]')
    .option(...preRequireParams)
    .option('-f, --feature <feature>')
    .option('-c, --config <config>')
    .option('--mode <mode>', 'mode passed to webpack', 'development')
    .option('--inspect')
    .option('-p ,--port <port>')
    .option('--singleRun', 'when enabled, webpack will not watch files', false)
    .option('--singleFeature', 'build only the feature set by --feature', false)
    .option('--publicPath <path>', 'public path prefix to use as base', defaultPublicPath)
    .option('--open <open>')
    .option('--title <title>', 'application title to display in browser')
    .option('--publicConfigsRoute <publicConfigsRoute>', 'public route for configurations')
    .allowUnknownOption(true)
    .action(async (path = process.cwd(), cmd: Record<string, any>) => {
        const {
            feature: featureName,
            config: configName,
            port: httpServerPort,
            singleRun,
            singleFeature,
            open: openBrowser = 'true',
            require: pathsToRequire,
            publicPath = defaultPublicPath,
            mode,
            title,
            publicConfigsRoute
        } = cmd;
        try {
            const basePath = resolve(path);
            preRequire(pathsToRequire, basePath);
            const app = new Application({ basePath });
            const { close: closeServer, port, nodeEnvironmentManager, setRunningConfig } = await app.start({
                featureName,
                configName,
                runtimeOptions: parseCliArguments(process.argv.slice(3)),
                inspect: cmd.inspect ? true : false,
                port: httpServerPort ? Number(httpServerPort) : undefined,
                singleRun,
                singleFeature,
                publicPath,
                mode,
                title,
                publicConfigsRoute
            });

            if (process.send) {
                process.send({ id: 'port-request', payload: { port } } as IProcessMessage<IPortMessage>);
            } else if (featureName && configName && openBrowser === 'true') {
                await open(`http://localhost:${port}/main.html`);
            }

            const processListener = async ({ id, payload }: IProcessMessage<unknown>) => {
                if (process.send) {
                    if (id === 'run-feature') {
                        const runOptions = payload as Required<IFeatureTarget>;
                        if (runOptions.config) {
                            setRunningConfig(runOptions.config);
                        }
                        await nodeEnvironmentManager.runServerEnvironments(runOptions);
                        process.send({ id: 'feature-initialized' });
                    }
                    if (id === 'close-feature') {
                        await nodeEnvironmentManager.closeEnvironment(payload as IFeatureMessage);
                        process.send({ id: 'feature-closed' } as IProcessMessage<IFeatureMessage>);
                    }
                    if (id === 'server-disconnect') {
                        await closeServer();
                        process.off('message', processListener);
                        process.send({ id: 'server-disconnected' } as IProcessMessage<unknown>);
                    }
                }
            };

            process.on('message', processListener);
        } catch (e) {
            printErrorAndExit(e);
        }
    });

program
    .command('build [path]')
    .option(...preRequireParams)
    .option('-f ,--feature <feature>')
    .option('-c ,--config <config>')
    .option('--mode <mode>', 'mode passed to webpack', 'production')
    .option('--outDir <outDir>')
    .option('--publicPath <path>', 'public path prefix to use as base', defaultPublicPath)
    .option('--singleFeature', 'build only the feature set by --feature', true)
    .option('--title <title>', 'application title to display in browser')
    .option('--publicConfigsRoute <publicConfigsRoute>', 'public route for configurations')
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
            publicConfigsRoute
        } = cmd;
        try {
            const basePath = resolve(path);
            preRequire(pathsToRequire, basePath);
            const outputPath = resolve(outDir);
            const app = new Application({ basePath, outputPath });
            const stats = await app.build({
                featureName,
                configName,
                publicPath,
                mode,
                singleFeature,
                title,
                publicConfigsRoute
            });
            console.log(stats.toString('errors-warnings'));
        } catch (e) {
            printErrorAndExit(e);
        }
    });

program
    .command('run [path]')
    .option(...preRequireParams)
    .option('-c ,--config <config>')
    .option('-f ,--feature <feature>')
    .option('--outDir <outDir>')
    .option('--publicPath <path>', 'public path prefix to use as base', defaultPublicPath)
    .option('-p ,--port <port>')
    .allowUnknownOption(true)
    .action(async (path = process.cwd(), cmd: Record<string, any>) => {
        const {
            config: configName,
            outDir = 'dist',
            feature: featureName,
            port: preferredPort,
            require: pathsToRequire,
            publicPath
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
                publicPath
            });
            console.log(`Listening:`);
            console.log(`http://localhost:${port}/main.html`);
        } catch (e) {
            printErrorAndExit(e);
        }
    });

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

program
    .command('remote [path]')
    .option('-p --port <port>')
    .action(async (path = process.cwd(), cmd: Record<string, string | undefined>) => {
        const { port: preferredPort } = cmd;
        try {
            const basePath = resolve(path);
            const app = new Application({ basePath });
            const port = preferredPort ? parseInt(preferredPort, 10) : undefined;
            await app.remote({ port });
        } catch (e) {
            printErrorAndExit(e);
        }
    });

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

program.parse(process.argv);

function preRequire(pathsToRequire: string[], basePath: string) {
    for (const request of pathsToRequire) {
        const resolvedRequest = resolveFrom(basePath, request);
        if (!resolvedRequest) {
            throw new Error(`cannot resolve required module: "${request}"`);
        }
        require(resolvedRequest);
    }
}

function printErrorAndExit(message: unknown) {
    console.error(message);
    process.exit(1);
}
