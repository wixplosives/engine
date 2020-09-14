/* eslint-disable @typescript-eslint/no-misused-promises */

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import program from 'commander';
import { resolve } from 'path';
import open from 'open';

import { version } from '../package.json';
import { resolvePackages, loadFeaturesFromPackages, runNodeEnvironment } from '@wixc3/engine-scripts';
import { BaseHost } from '@wixc3/engine-core';
import fs from '@file-services/node';
import devServerFeature, { devServerEnv } from 'packages/engineer/feature/dev-server.feature';
import guiFeature from '../feature/gui.feature';

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
    .option('--engineerMode <gui|build>', 'interactive mode for engineer', 'gui')
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
            publicConfigsRoute = 'configs/',
            autoLaunch,
            engineerMode,
        } = cmd;
        try {
            const basePath = resolve(__dirname, '../../engineer');
            preRequire(pathsToRequire, basePath);

            const features = loadFeaturesFromPackages(resolvePackages(basePath), fs).features;

            await runNodeEnvironment({
                featureName: `engineer/${engineerMode as string}`,
                features: [...features],
                name: devServerEnv.env,
                type: 'node',
                host: new BaseHost(),
                config: [
                    devServerFeature.use({
                        devServerConfig: {
                            httpServerPort,
                            featureName,
                            singleRun,
                            singleFeature,
                            publicPath,
                            mode,
                            configName,
                            title,
                            publicConfigsRoute,
                            autoLaunch,
                            basePath: path,
                        },
                    }),
                    guiFeature.use({
                        engineerConfig: {
                            features,
                        },
                    }),
                ],
            });

            if (!process.send && featureName && configName && openBrowser === 'true') {
                await open(`http://localhost:${httpServerPort as string}/main.html`);
            }
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
