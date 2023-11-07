import { BuildOptions, Plugin } from 'esbuild';
import fs from 'node:fs';
import { dirname, join } from 'node:path';

export interface PartialWebpackLoaderContext {
    query: string;
    resourcePath: string;
    rootContext: string;
    addDependency(filePath: string): void;
    emitFile(filePath: string, contents: string, sourcemap: boolean): void;
}

export function topLevelConfigPlugin({ emit = true }: { emit?: boolean }) {
    const plugin: Plugin = {
        name: 'top-level-config-loader',
        setup(build) {
            const filesToEmit = new Map<string, { content: string; path: string }>();

            build.onResolve({ filter: /top-level-config-loader/ }, (args) => {
                return {
                    path: args.path,
                    namespace: 'top-level-config-loader',
                };
            });

            build.onLoad({ filter: /.*/, namespace: 'top-level-config-loader' }, (args) => {
                const queryMatch = args.path.match(/\?(.*?)$/);
                if (!queryMatch || !queryMatch[1]) {
                    throw new Error('top-level-config-loader: query is missing');
                }
                const [query, resourcePath] = queryMatch[1].split('!');
                if (!resourcePath) {
                    throw new Error('top-level-config-loader: resourcePath is missing');
                }
                if (!query) {
                    throw new Error('top-level-config-loader: query is missing');
                }
                const params = new URLSearchParams(query);
                const fileName = params.get('scopedName');
                const envName = params.get('envName');
                const configLoaderModuleName = params.get('configLoaderModuleName');

                if (emit) {
                    emitConfigFile(resourcePath, envName, fileName, filesToEmit, build.initialOptions);
                }

                const module = `
                    import { loadConfig } from '${configLoaderModuleName!}';
                    const fetchResult = loadConfig(${JSON.stringify(fileName)}, ${JSON.stringify(envName)});
                    export default fetchResult;
                `;

                return {
                    contents: module,
                    loader: 'js',
                    resolveDir: '.',
                };
            });
            build.onEnd(() => {
                for (const { content, path } of filesToEmit.values()) {
                    fs.mkdirSync(dirname(path), { recursive: true });
                    fs.writeFileSync(path, content);
                }
                filesToEmit.clear();
            });
        },
    };
    return plugin;
}

function emitConfigFile(
    resourcePath: string,
    envName: string | null,
    fileName: string | null,
    filesToEmit: Map<string, { content: string; path: string }>,
    initialOptions: BuildOptions,
) {
    const outDir = initialOptions.outdir;
    if (!outDir) {
        throw new Error('top-level-config-loader: outdir configuration is missing');
    }
    const rootContext = initialOptions.absWorkingDir || process.cwd();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const imported = require(resourcePath);
    const content = JSON.stringify(imported.default ?? imported);
    const configFileName = envName ? `${fileName!}.${envName}` : fileName;
    const configPath = `configs/${configFileName!}.json`;
    filesToEmit.set(configPath, { content, path: join(rootContext, outDir, configPath) });
}
