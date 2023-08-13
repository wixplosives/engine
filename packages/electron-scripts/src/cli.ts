import { Command } from 'commander';

process.on('unhandledRejection', reportProcessError);
process.on('uncaughtException', reportProcessError);

const program = new Command();

function createCommand(commandName: string): Command {
    return program
        .command(commandName)
        .requiredOption('-f, --featureName <featureName>')
        .option('-c, --configName <configName>')
        .requiredOption('-e, --envName <envName>', 'The name of the electron main process environment')
        .option('--basePath <basePath>', undefined, process.cwd())
        .option('--featureDiscoveryRoot <featureDiscoveryRoot>')
        .option('--singleFeature');
}

createCommand('start')
    .description('starts the electron application in dev mode')
    .option('--devtools')
    .action(async (options) => {
        const { start } = await import('./commands/start.js');
        await start(options);
    });

createCommand('build')
    .description('builds the electron application')
    .option(
        '--outDir <outDir>',
        'the directory to which the bundled and transpiled code will be saved (relative to basePath)',
        'dist',
    )
    .option(
        '--electronBuilderConfigFileName <electronBuilderConfigFileName>',
        'The name of the electron builder config file (relative to basePath)',
        'electron-build.json',
    )
    .option('--linux')
    .option('--mac')
    .option('--windows')
    .option('--publish <publish>')
    .option('--eagerEntrypoint')
    .action(async (options) => {
        const { build } = await import('./commands/build.js');
        await build(options);
    });

program.parseAsync().catch(reportProcessError);

function reportProcessError(error: unknown): void {
    console.log(error);
    process.exitCode = 1;
}
