import { reduce } from '@wixc3/common';
import Module from 'module';

/**
 * Evaluate modules and return a root module.
 *
 * @param filePaths list of modules files to evaluate
 */
export function evaluateModule(filePaths: string | Iterable<string>): NodeJS.Module {
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
    const source = reduce(filePaths, (acc, filePath) => `${acc}require(${JSON.stringify(filePath)});\n`, '');
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const evalModule = new Function('module', 'exports', 'require', source);
    evalModule(entryModule, entryModule.exports, entryModule.require.bind(entryModule));
    return entryModule;
}
