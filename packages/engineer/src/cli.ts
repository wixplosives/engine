import { Command } from 'commander';

import { cleanCommand, buildCommand, runCommand, createCommand, CliApplication, startCommand } from './cli-commands.js';

const program = new Command();

// eslint-disable-next-line @typescript-eslint/no-var-requires
program.version((require('../package.json') as { version: string }).version);

const cliApplication = new CliApplication(program, [
    startCommand,
    buildCommand,
    createCommand,
    runCommand,
    cleanCommand,
]);

cliApplication.parse(process.argv);
