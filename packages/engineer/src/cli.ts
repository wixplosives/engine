/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import program from 'commander';

import {
    cleanCommand,
    buildCommand,
    runCommand,
    createCommand,
    remoteCommand,
    CliApplication,
    startCommand,
} from './cli-commands';

// eslint-disable-next-line @typescript-eslint/no-var-requires
program.version((require('../package.json') as { version: string }).version);

const cliApplication = new CliApplication(program, [
    startCommand,
    buildCommand,
    createCommand,
    runCommand,
    remoteCommand,
    cleanCommand,
]);

cliApplication.parse(process.argv);
