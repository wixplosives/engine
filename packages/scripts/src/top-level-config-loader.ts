import { loader as webpackLoader } from 'webpack';

export default function(this: webpackLoader.LoaderContext) {
    const imported = requireDeepHack(this.resourcePath, this.rootContext);
    walkChildModules(require.cache[this.resourcePath], ({ filename }) => {
        if (!filename.includes('node_modules') && filename.includes(this.rootContext)) {
            this.addDependency(filename);
        }
    });
    return `export default JSON.parse(${JSON.stringify(JSON.stringify(imported))})`;
}

function walkChildModules(nodeJsModule: NodeModule, visitor: (module: NodeModule) => void, registryCache = new Set()) {
    if (!nodeJsModule || registryCache.has(nodeJsModule)) {
        return;
    }
    registryCache.add(nodeJsModule);
    visitor(nodeJsModule);
    if (nodeJsModule && nodeJsModule.children) {
        nodeJsModule.children.forEach(cm => {
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
    const imported = require(resourcePath) as { default?: any };
    for (const [key, nodeModule] of Object.entries(previousCache)) {
        require.cache[key] = nodeModule;
    }

    return imported.default ?? imported;
}
