import { Plugin } from 'esbuild';
import fs from 'fs';
import { join, dirname } from 'path';

export interface PartialWebpackLoaderContext {
    query: string;
    resourcePath: string;
    rootContext: string;
    addDependency(filePath: string): void;
    emitFile(filePath: string, contents: string, sourcemap: boolean): void;
}

export function topLevelConfigPlugin() {
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
                const rootContext = build.initialOptions.absWorkingDir || process.cwd();
                const outDir = build.initialOptions.outdir;
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

                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const imported = require(resourcePath);
                const content = JSON.stringify(imported);

                const configFileName = envName ? `${fileName!}.${envName}` : fileName;
                const configPath = `configs/${configFileName!}.json`;

                filesToEmit.set(configPath, { content, path: join(rootContext, outDir!, configPath) });

                const module = `
                    import { loadConfig } from '${configLoaderModuleName!}';
                    const fetchResult = loadConfig(${JSON.stringify(fileName)}, ${JSON.stringify(envName)});
                    export default fetchResult
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

function walkChildModules(nodeJsModule: NodeModule, visitor: (module: NodeModule) => void, registryCache = new Set()) {
    if (!nodeJsModule || registryCache.has(nodeJsModule)) {
        return;
    }
    registryCache.add(nodeJsModule);
    visitor(nodeJsModule);
    if (nodeJsModule && nodeJsModule.children) {
        nodeJsModule.children.forEach((cm) => {
            walkChildModules(cm, visitor, registryCache);
        });
    }
}
