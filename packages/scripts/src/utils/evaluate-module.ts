import { Module } from 'module';

/**
 * Evaluate modules and return a root module.
 *
 * @param filePaths list of modules files to evaluate
 */
export function evaluateModule(filePaths: string | string[]): NodeJS.Module {
    filePaths = typeof filePaths === 'string' ? [filePaths] : filePaths;
    const entryModule = new Module('entry-module');
    entryModule.filename = 'entry-module.js';
    // we want node to be able to resolve package requests. we use first module to calculate lookup locations
    const [firstModulePath] = filePaths;
    if (firstModulePath) {
        const resolutionPaths = require.resolve.paths(firstModulePath);
        if (resolutionPaths) {
            entryModule.paths = resolutionPaths;
        }
    }
    const source = filePaths.map((filePath) => `require(${JSON.stringify(filePath)});`).join('\n');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const evalModule = new Function('module', 'exports', 'require', source);
    evalModule(entryModule, entryModule.exports, entryModule.require.bind(entryModule));
    return entryModule;
}
