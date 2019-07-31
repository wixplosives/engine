// tslint:disable: no-console

import program from 'commander';
import { join } from 'path';
import { version } from '../package.json';
import { Application, IFeatureTarget } from './application';
import { IFeatureMessage, IPortMessage, IProcessMessage } from './types';

Error.stackTraceLimit = 100;

program.version(version);

program
    .command('start [path]')
    .option('-f ,--feature <feature>')
    .option('-c ,--config <config>')
    .option('-p ,--project <project>')
    .option('--inspect')
    .action(async (path, cmd: Record<string, string | undefined>) => {
        const { feature, config, project, inspect = false } = cmd;
        try {
            const app = new Application(path || process.cwd());
            const { runFeature } = await app.start({
                inspect: inspect ? true : false
            });
            await runFeature({ featureName: feature, configName: config, projectPath: project });
        } catch (e) {
            printErrorAndExit(e);
        }
    });

program
    .command('start-engine-server [path]')
    .option('--inspect')
    .action(async (path, cmd) => {
        try {
            const app = new Application(path || process.cwd());
            const { inspect } = cmd;
            const { close: closeServer, port, runFeature } = await app.start({ singleRun: true, inspect });
            const closeEngineFunctions: Map<number, () => Promise<void>> = new Map();
            let runningFeatureUuid = 0;
            if (process.send) {
                process.send({ id: 'port', payload: { port } } as IProcessMessage<IPortMessage>);
            }

            const processListener = async ({ id, payload }: IProcessMessage<unknown>) => {
                if (process.send) {
                    if (id === 'run-feature') {
                        const { close: closeEngine } = await runFeature(payload as IFeatureTarget);
                        closeEngineFunctions.set(++runningFeatureUuid, closeEngine);

                        process.send({
                            id: 'feature-initialized',
                            payload: { id: runningFeatureUuid }
                        } as IProcessMessage<IFeatureMessage>);
                    }
                    if (id === 'close-feature') {
                        const { id: closeFunctionId } = payload as IFeatureMessage;
                        const closeEngineFunction = closeEngineFunctions.get(closeFunctionId);
                        if (closeEngineFunction) {
                            await closeEngineFunction();
                            closeEngineFunctions.delete(closeFunctionId);
                            process.send({ id: 'feature-closed' } as IProcessMessage<IFeatureMessage>);
                        }
                    }
                    if (id === 'server-disconnect') {
                        await closeServer();
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
    .option('-f ,--feature <feature>')
    .option('-c ,--config <config>')
    .option('--out-dir <outDir>')
    .action(async (path = process.cwd(), cmd) => {
        const { feature, config, outDir = 'dist' } = cmd;
        try {
            const app = new Application(path, join(path, outDir));
            const stats = await app.build(feature, config);
            console.log(stats.toString({ colors: true }));
        } catch (e) {
            printErrorAndExit(e);
        }
    });

program
    .command('clean [path]')
    .option('--dist')
    .option('--npm')
    .action(async (path, cmd) => {
        try {
            if (cmd.dist || (!cmd.dist && cmd.npm)) {
                const app = new Application(path || process.cwd());
                await app.clean();
            }
            if (cmd.npm) {
                const app = new Application(path || process.cwd(), join(path || process.cwd(), 'npm'));
                await app.clean();
            }
        } catch (e) {
            printErrorAndExit(e);
        }
    });

program.parse(process.argv);

function printErrorAndExit(message: unknown) {
    console.error(message);
    process.exit(1);
}
