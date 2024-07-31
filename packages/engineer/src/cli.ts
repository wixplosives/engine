import fs from 'node:fs';
import { Command } from 'commander';
import { buildCommand, cleanCommand, CliApplication, runCommand, startCommand } from './cli-commands.js';

const packageJsonPath = require.resolve('../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    version: string;
};

const program = new Command();

program.version(packageJson.version);

const cliApplication = new CliApplication(program, [startCommand, buildCommand, runCommand, cleanCommand]);

cliApplication.parse(process.argv);
