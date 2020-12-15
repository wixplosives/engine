/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */

import program from 'commander';
import { buildCommand, cleanCommand, remoteCommand, runCommand, createCommand, CliApplication } from './cli-commands';
// eslint-disable-next-line @typescript-eslint/no-var-requires
program.version((require('../package.json') as { version: string }).version);

const cli = new CliApplication(program, [buildCommand, runCommand, remoteCommand, createCommand, cleanCommand]);
cli.parse(process.argv);
