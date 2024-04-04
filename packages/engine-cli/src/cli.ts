import { cli, command } from 'cleye';
import { analyzeCommand } from './analyze-command';

async function engine() {
    const argv = cli({
        commands: [
            command({
                name: 'analyze',
                flags: {
                    feature: {
                        type: String,
                        description: 'Feature name',
                        default: undefined,
                    },
                    engineConfigFilePath: {
                        type: String,
                        description: 'Engine config file path',
                        default: undefined,
                    },
                },
            }),
        ],
        name: 'engine',
        help: {
            usage: false,
            description: 'Run and build engine applications',
        },
        flags: {
            feature: {
                type: String,
                description: 'Feature name',
                default: undefined,
            },
            config: {
                type: String,
                description: 'Config name',
                default: undefined,
            },
            runtimeArgs: {
                type: (value) => {
                    const args = JSON.parse(value);
                    if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
                        return args as Record<string, string | boolean>;
                    } else {
                        throw new Error(`Invalid runtime arguments: ${value} (expected JSON object)`);
                    }
                },
                description: `Runtime arguments E.g. '{"projectPath": "..."}'`,
                default: {},
            },
            clean: {
                type: Boolean,
                description: 'Clean output directory',
                default: true,
            },
            dev: {
                type: Boolean,
                description: 'Development mode',
                default: undefined,
            },
            watch: {
                type: Boolean,
                description: 'Watch for changes',
                default: false,
            },
            run: {
                type: Boolean,
                description: 'Run the application',
                default: undefined,
            },
            forceAnalyze: {
                type: Boolean,
                description: 'Force analyze features',
                default: true,
            },
            engineConfigFilePath: {
                type: String,
                description: 'Engine config file path',
                default: undefined,
            },
            publicConfigsRoute: {
                type: String,
                description: 'Public configs route',
                default: 'configs',
            },
            writeMetadataFiles: {
                type: Boolean,
                description: 'Write metadata files',
                default: true,
            },
            buildTargets: {
                type: (value) => {
                    if (value === 'node' || value === 'web' || value === 'both' || value === 'electron') {
                        return value as 'node' | 'web' | 'both' | 'electron';
                    } else {
                        throw new Error(`Invalid build targets: ${value} (expected node, web, both)`);
                    }
                },
                description: 'Build targets (node, web, both)',
                default: 'both',
            },
            publicPath: {
                type: String,
                description: 'Public path',
                default: '',
            },
            configLoadingMode: {
                type: (value) => {
                    if (value === 'fresh' || value === 'watch' || value === 'require') {
                        return value as 'fresh' | 'watch' | 'require';
                    } else {
                        throw new Error(`Invalid config loading mode: ${value}`);
                    }
                },
                description: 'Config loading mode (fresh, watch, require)',
                default: undefined,
            },
            verbose: {
                type: Boolean,
                description: 'Verbose output',
                default: false,
            },
        },
    } as const);
    const { loadEngineConfig, runEngine } = await import('./engine-build');

    const engineConfig = await loadEngineConfig(process.cwd(), argv.flags.engineConfigFilePath);
    const rootDir = process.cwd();
    if (argv.command === 'analyze') {
        await analyzeCommand({ rootDir, feature: argv.flags.feature, engineConfig });
    } else {
        const dev = argv.flags.dev ?? argv.flags.watch;
        const run = argv.flags.run ?? dev;
        const configLoadingMode = argv.flags.configLoadingMode ?? (argv.flags.watch ? 'watch' : 'require');

        await runEngine({
            rootDir,
            ...argv.flags,
            dev,
            run,
            configLoadingMode,
            engineConfig,
        });
    }
}

engine().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
