import Module from 'module';

/**
 * Evaluate modules and return a root module.
 *
 * @param filePaths list of modules files to evaluate
 */
export function evaluateModule(filePaths: string | string[]): Module {
    filePaths = typeof filePaths === 'string' ? [filePaths] : filePaths;
    const entryModule = new Module('entry-module');
    entryModule.filename = 'entry-module.js';
    const resolutionPaths = require.resolve.paths(filePaths[0]);
    if (resolutionPaths) {
        entryModule.paths = resolutionPaths;
    }
    const source = filePaths.map(filePath => `require(${JSON.stringify(filePath)});`).join('\n');
    const evalModule = new Function('module', 'exports', 'require', source);
    evalModule(entryModule, entryModule.exports, entryModule.require.bind(entryModule));
    return entryModule;
}
