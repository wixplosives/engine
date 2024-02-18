import crypto from 'node:crypto';
import esbuild from 'esbuild';
import { runInContext, createContext } from 'node:vm';

type BuildStats = {
    error: Error | undefined;
    currentValue: Promise<unknown[]> | unknown[];
    dispose(): Promise<void>;
    build?: ReturnType<typeof deferred<unknown[]>>;
};

export class NodeConfigManager {
    constructor(private config: esbuild.BuildOptions) {}
    runningBuilds = new Map<string, BuildStats>();
    hashConfig(entryPoints: string[]) {
        return hash(entryPoints.join(','));
    }
    async loadConfigs(entryPoints: string[]) {
        const key = this.hashConfig(entryPoints);
        const currentBuild = this.runningBuilds.get(key);
        if (!currentBuild) {
            const buildStats: BuildStats = {
                error: undefined,
                currentValue: Promise.reject(new Error('No build')),
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
    async dispose() {
        for (const build of this.runningBuilds.values()) {
            await build.dispose();
        }
    }
    private async createBuildTask(
        entryPoints: string[],
        hooks: {
            onStart(): void;
            onEnd(files: undefined[]): void;
            onError(err: Error): void;
        },
    ) {
        const deferredStart = deferred<void>();
        const ctx = await esbuild.context({
            ...this.config,
            stdin: {
                contents: `
                    ${entryPoints.map((entry, i) => `import config_${i} from '${entry}';`).join('\n')}
                    export default [${entryPoints.map((_, i) => `config_${i}`).join(',')}];
                `,
                loader: 'js',
                sourcefile: 'generated-configs-entry.js',
                resolveDir: this.config.absWorkingDir,
            },
            plugins: [
                {
                    name: 'on-build',
                    setup(build) {
                        build.onStart(() => {
                            console.log('Building configs...');
                            hooks.onStart();
                            deferredStart.resolve();
                        });
                        build.onEnd(({ outputFiles }) => {
                            if (!outputFiles) {
                                throw new Error('No output files');
                            }
                            if (outputFiles.length === 0) {
                                throw new Error('No output files');
                            }
                            const text = outputFiles[0]!.text;
                            const module = { exports: {} };
                            const r = runInContext(text, createContext({ module, exports: module.exports })).default;
                            hooks.onEnd(r);
                        });
                    },
                },
                ...(this.config.plugins || []),
            ],
            format: 'cjs',
            bundle: true,
            write: false,
        });

        await Promise.all([ctx.watch(), deferredStart.promise]);
        return ctx;
    }
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function hash(str: string) {
    return crypto.createHash('sha256').update(str).digest('hex');
}
