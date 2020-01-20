const freshImport = require('import-fresh');

const loader = function() {
    walkChildModules(require.cache[this.resourcePath], ({ filename }) => {
        if(!filename.includes('node_modules') && filename.includes(this.rootContext)) {
            delete require.cache[filename];
        }
    });
    const imported = freshImport(this.resourcePath);
    walkChildModules(require.cache[this.resourcePath], ({filename}) => {
        if(!filename.includes('node_modules') && filename.includes(this.rootContext)){
            this.addDependency(filename);
        }        
    });
    return `export default JSON.parse(${JSON.stringify(JSON.stringify(imported.default || imported))})`;
};

function walkChildModules(nodeJsModule, visitor, registryCache = new Set()) {
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

module.exports = loader;
