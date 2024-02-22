import crypto from 'node:crypto';
import esbuild from 'esbuild';
import { join } from 'node:path';
import { deferred } from 'promise-assist';
import { importFresh } from '@wixc3/engine-scripts';

type BuildStats = {
    error: unknown;
    currentValue: Promise<unknown[]> | unknown[];
    dispose(): Promise<void>;
    build?: ReturnType<typeof deferred<unknown[]>>;
};

export class NodeConfigManager {
    constructor(
        mode: 'watch' | 'fresh' = 'watch',
        private config: esbuild.BuildOptions,
    ) {
        if (mode === 'watch') {
            this.loadConfigs = (entryPoints: string[]) => this.watchConfigs(entryPoints);
        } else {
            this.loadConfigs = (entryPoints: string[]) => importFresh(entryPoints, 'default');
        }
    }
    runningBuilds = new Map<string, BuildStats>();
    hashConfig(entryPoints: string[]) {
        return crypto.createHash('sha256').update(entryPoints.join(',')).digest('hex');
    }
    loadConfigs: (_entryPoints: string[]) => Promise<unknown[]>;
    async watchConfigs(entryPoints: string[]) {
        const key = this.hashConfig(entryPoints);
        const currentBuild = this.runningBuilds.get(key);
        if (!currentBuild) {
            const buildStats: BuildStats = {
                error: undefined,
                // this is cannot be undefined after build
                currentValue: undefined as any,
                build: undefined,
                dispose() {
                    return ctx.dispose();
                },
            };
            this.runningBuilds.set(key, buildStats);

            const ctx = await this.createBuildTask(entryPoints, {
                onStart() {
                    const newBuild = deferred<unknown[]>();
                    buildStats.error = undefined;
                    buildStats.currentValue = newBuild.promise;
                    buildStats.build = newBuild;
                },
                onEnd(files) {
                    buildStats.error = undefined;
                    buildStats.currentValue = files;
                    buildStats.build?.resolve(files);
                },
                onError(err) {
                    buildStats.error = err;
                    buildStats.build?.reject(err);
                },
            });

            if (!buildStats.build) {
                throw new Error('No build');
            }

            return buildStats.build.promise;
        } else {
            if (currentBuild.error) {
                throw currentBuild.error;
            }
            return currentBuild.currentValue;
        }
    }
    disposeBuild(entryPoints: string[]): Promise<void> | void {
        const key = this.hashConfig(entryPoints);
        const build = this.runningBuilds.get(key);
        if (build) {
            this.runningBuilds.delete(key);
            return build.dispose();
        }
    }
    async disposeAll() {
        for (const build of this.runningBuilds.values()) {
            await build.dispose();
        }
        this.runningBuilds.clear();
    }
    async dispose() {
        await this.disposeAll();
    }
    private async createBuildTask(
        entryPoints: string[],
        hooks: {
            onStart(): void;
            onEnd(files: unknown[]): void;
            onError(err: unknown): void;
        },
    ) {
        const deferredStart = deferred<void>();
        const absWorkingDir = this.config.absWorkingDir || process.cwd();
        const ctx = await esbuild.context({
            ...this.config,
            stdin: {
                contents: `
                    ${entryPoints.map((entry, i) => `import config_${i} from ${JSON.stringify(entry)};`).join('\n')}
                    export default [${entryPoints.map((_, i) => `config_${i}`).join(',')}];
                `,
                loader: 'js',
                sourcefile: 'generated-configs-entry.js',
                resolveDir: absWorkingDir,
            },
            plugins: [
                {
                    name: 'on-build',
                    setup(build) {
                        build.onStart(() => {
                            hooks.onStart();
                            deferredStart.resolve();
                        });
                        build.onEnd(({ outputFiles }) => {
                            if (!outputFiles || outputFiles.length === 0) {
                                hooks.onError(new Error('No output files'));
                                return;
                            }
                            try {
                                const text = outputFiles[0]!.text;
                                const module = { exports: { default: undefined as any } };
                                // eslint-disable-next-line @typescript-eslint/no-implied-eval
                                new Function('module', 'exports', 'require', '__dirname', '__filename', text)(
                                    module,
                                    module.exports,
                                    require,
                                    absWorkingDir,
                                    join(absWorkingDir, 'generated-configs-entry.js'),
                                );
                                if (!Array.isArray(module.exports.default)) {
                                    throw new Error('Expected default export to be an array');
                                }
                                hooks.onEnd(module.exports.default as unknown[]);
                            } catch (err) {
                                hooks.onError(err);
                                return;
                            }
                        });
                    },
                },
                ...(this.config.plugins || []),
            ],
            platform: 'node',
            treeShaking: true,
            format: 'cjs',
            bundle: true,
            write: false,
        });

        await Promise.all([ctx.watch(), deferredStart.promise]);
        return ctx;
    }
}
