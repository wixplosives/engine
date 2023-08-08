import yargs from 'yargs';
import { build, start } from './commands/index.js';

yargs()
    .command('start', 'starts the electron application in dev mode', async (command) => {
        const options = command
            .option('featureName', {
                alias: 'f',
                type: 'string',
                required: true,
            })
            .option('configName', {
                alias: 'c',
                type: 'string',
            })
            .option('envName', {
                alias: 'e',
                type: 'string',
                demandOption: true,
            })
            .option('basePath', {
                type: 'string',
            })
            .option('devtools', {
                type: 'boolean',
            })
            .option('featureDiscoveryRoot', {
                type: 'string',
            })
            .parseSync();

        await start({
            ...options,
        });
    })
    .command('build', 'builds the elecrton application', async (command) => {
        const options = command
            .option('featureName', {
                alias: 'f',
                type: 'string',
                demandOption: true,
            })
            .option('configName', {
                alias: 'c',
                type: 'string',
            })
            .option('basePath', {
                default: process.cwd(),
            })
            .option('outDir', {
                default: 'dist',
                describe: 'the directory to which the bundled and transpiled code will be saved (relative to basePath)',
            })
            .option('envName', {
                alias: 'e',
                type: 'string',
                demandOption: true,
                describe: 'The name of the electron main process environment',
            })
            .option('electronBuilderConfigFileName', {
                describe: 'The name of the electrion builder config file (relative to basePath)',
                default: 'electron-build.json',
            })
            .option('linux', {
                type: 'boolean',
                default: undefined,
            })
            .option('mac', {
                type: 'boolean',
                default: undefined,
            })
            .option('windows', {
                type: 'boolean',
                default: undefined,
            })
            .option('publish', {
                type: 'string',
            })
            .option('featureDiscoveryRoot', {
                type: 'string',
            })
            .option('eagerEntrypoint', {
                type: 'boolean',
                default: false,
            })
            .parseSync();

        await build({
            ...options,
        });
    })
    .parseAsync()
    .catch((e) => {
        process.exitCode = 1;
        // eslint-disable-next-line no-console
        console.log(e);
    });
