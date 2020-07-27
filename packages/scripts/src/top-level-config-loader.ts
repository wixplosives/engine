import type { loader as webpackLoader } from 'webpack';

export default function topLevelConfigLoader(this: webpackLoader.LoaderContext) {
    const params = new URLSearchParams(this.query.slice(1));

    const fileName = params.get('scopedName');
    const envName = params.get('envName');

    const imported = requireDeepHack(this.resourcePath, this.rootContext);
    walkChildModules(require.cache[this.resourcePath], ({ filename }) => {
        if (!filename.includes('node_modules') && filename.includes(this.rootContext)) {
            this.addDependency(filename);
        }
    });
    const importedString = JSON.stringify(imported);

    const configFileName = envName ? `${fileName!}.${envName}` : fileName;
    const configPath = `configs/${configFileName!}.json`;

    this.emitFile(configPath, importedString, false);

    return `
    const fetchResult = fetch(__webpack_public_path__ + ${JSON.stringify(configPath)}).then(res=> res.json());
    export default fetchResult`;
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

/**
 * This all method is a hack that allows fresh requiring modules
 */
function requireDeepHack(resourcePath: string, rootContext: string) {
    const previousCache: Record<string, NodeModule> = {};
    walkChildModules(require.cache[resourcePath], ({ filename }) => {
        if (!filename.includes('node_modules') && filename.includes(rootContext)) {
            previousCache[filename] = require.cache[filename];
            delete require.cache[filename];
        }
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const imported = require(resourcePath) as { default?: any };
    for (const [key, nodeModule] of Object.entries(previousCache)) {
        require.cache[key] = nodeModule;
    }

    return imported.default ?? imported;
}
