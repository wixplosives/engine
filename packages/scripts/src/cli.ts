/* eslint-disable @typescript-eslint/no-misused-promises */

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import program from 'commander';
import { resolve } from 'path';
import open from 'open';

import { version } from '../package.json';
import { Application } from './application';
import type { IFeatureMessagePayload, IPortMessage, IProcessMessage, IFeatureTarget } from './types';
import { parseCliArguments } from './utils';

program.version(version);

const parseBoolean = (value: string) => value === 'true';
const collectMultiple = (val: string, prev: string[]) => [...prev, val];
const defaultPublicPath = process.env.ENGINE_PUBLIC_PATH || '/';

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
            publicConfigsRoute,
            autoLaunch,
        } = cmd;
        try {
            const basePath = resolve(path);
            preRequire(pathsToRequire, basePath);
            const app = new Application({ basePath });
            const { close: closeServer, port, runFeature, closeFeature, getMetrics } = await app.start({
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
                publicConfigsRoute,
                autoLaunch,
            });

            if (process.send) {
                process.send({ id: 'port-request', payload: { port } } as IProcessMessage<IPortMessage>);
            } else if (featureName && configName && openBrowser === 'true') {
                await open(`http://localhost:${port}/main.html`);
            }

            const processListener = async ({ id, payload }: IProcessMessage<unknown>) => {
                if (process.send) {
                    if (id === 'run-feature') {
                        const responsePayload = await runFeature(payload as Required<IFeatureTarget>);
                        process.send({ id: 'feature-initialized', payload: responsePayload });
                    }
                    if (id === 'close-feature') {
                        await closeFeature(payload as IFeatureMessagePayload);
                        process.send({ id: 'feature-closed' });
                    }
                    if (id === 'server-disconnect') {
                        await closeServer();
                        process.off('message', processListener);
                        process.send({ id: 'server-disconnected' });
                    }
                    if (id === 'metrics-request') {
                        process.send({
                            id: 'metrics-response',
                            payload: getMetrics(),
                        });
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
    .option('-r, --require <path>', 'path to require before anything else', collectMultiple, [])
    .option('-f ,--feature <feature>')
    .option('-c ,--config <config>')
    .option('--mode <production|development>', 'mode passed to webpack', 'production')
    .option('--outDir <outDir>')
    .option('--publicPath <path>', 'public path prefix to use as base', defaultPublicPath)
    .option('--singleFeature [true|false]', 'build only the feature set by --feature', parseBoolean, true)
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
            publicConfigsRoute,
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
                publicConfigsRoute,
            });
            console.log(stats.toString('errors-warnings'));
        } catch (e) {
            printErrorAndExit(e);
        }
    });

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
        const resolvedRequest = require.resolve(request, { paths: [basePath] });
        require(resolvedRequest);
    }
}

function printErrorAndExit(message: unknown) {
    console.error(message);
    process.exit(1);
}
