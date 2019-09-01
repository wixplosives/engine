// tslint:disable: no-console

import program from 'commander';
import { join } from 'path';
import { version } from '../package.json';
import { Application, IFeatureTarget } from './application';
import { IFeatureMessage, IPortMessage, IProcessMessage } from './types';

Error.stackTraceLimit = 100;

program.version(version);

const kebabCaseToCamelCase = (value: string): string => value.replace(/[-]\S/g, match => match.slice(1).toUpperCase());

function parseCliArguments(args: string[]) {
    const argumentQueue: string[] = [];
    const options: Record<string, string | boolean> = {};
    while (args.length) {
        const currentArgument = args.shift()!;
        if (currentArgument.startsWith('--')) {
            if (argumentQueue.length) {
                options[argumentQueue.shift()!] = argumentQueue.length ? argumentQueue.join(' ') : true;
                argumentQueue.length = 0;
            }
            argumentQueue.push(kebabCaseToCamelCase(currentArgument.slice(2)));
        } else if (argumentQueue.length) {
            argumentQueue.push(currentArgument);
        } else if (args.length && !args[0].startsWith('--')) {
            args.shift();
        }
    }
    if (argumentQueue.length) {
        options[argumentQueue.shift()!] = argumentQueue.join(' ');
    }
    return options;
}

program
    .command('start [path]')
    .option('-f ,--feature <feature>')
    .option('-c ,--config <config>')
    .option('--inspect')
    .allowUnknownOption(true)
    .action(async (path, cmd: Record<string, string | undefined>) => {
        const { feature: featureName, config: configName } = cmd;
        try {
            const app = new Application({ basePath: path || process.cwd() });
            const { close: closeServer, port, nodeEnvironmentManager } = await app.start({
                featureName,
                configName,
                defaultRuntimeOptions: parseCliArguments(process.argv.slice(3)),
                inspect: cmd.inspect ? true : false
            });

            if (process.send) {
                process.send({ id: 'port-request', payload: { port } } as IProcessMessage<IPortMessage>);
            }

            const processListener = async ({ id, payload }: IProcessMessage<unknown>) => {
                if (process.send) {
                    if (id === 'run-feature') {
                        await nodeEnvironmentManager.runEnvironment(payload as Required<IFeatureTarget>);
                        process.send({ id: 'feature-initialized' });
                    }
                    if (id === 'close-feature') {
                        await nodeEnvironmentManager.closeEnvironment(payload as IFeatureMessage);
                        process.send({ id: 'feature-closed' } as IProcessMessage<IFeatureMessage>);
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
    .action(async (path = process.cwd(), cmd: Record<string, string | undefined>) => {
        const { feature: featureName, config: configName, outDir = 'dist' } = cmd;
        try {
            const app = new Application({ basePath: path, outputPath: join(path, outDir) });
            const stats = await app.build({ featureName, configName });
            console.log(stats.toString('errors-warnings'));
        } catch (e) {
            printErrorAndExit(e);
        }
    });

program
    .command('run [path]')
    .option('-c ,--config <config>')
    .option('-f ,--feature <feature>')
    .option('--out-dir <outDir>')
    .action(async (path = process.cwd(), cmd: Record<string, string | undefined>) => {
        const { config: configName, outDir = 'dist', feature: featureName } = cmd;

        try {
            const app = new Application({ basePath: path, outputPath: join(path, outDir) });
            const { port } = await app.run({
                configName,
                featureName,
                defaultRuntimeOptions: parseCliArguments(process.argv.slice(3))
            });
            console.log(`Listening:`);
            console.log(`http://localhost:${port}/main.html`);
        } catch (e) {
            printErrorAndExit(e);
        }
    });

program.command('clean [path]').action(async path => {
    const app = new Application({ basePath: path || process.cwd() });
    try {
        console.log(`Removing: ${app.outputPath}`);
        await app.clean();
    } catch (e) {
        printErrorAndExit(e);
    }
});

program.parse(process.argv);

function printErrorAndExit(message: unknown) {
    console.error(message);
    process.exit(1);
}
