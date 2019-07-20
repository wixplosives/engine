import Module from 'module';
import { resolveFrom } from './resolve-from';

/**
 * Evaluate modules and return a root module.
 *
 * @param modulesPaths list of modules files to evaluate
 * @param basePath base path to resolve from
 */
export function evalFeatureSet(modulesPaths: string | string[], basePath: string): NodeModule {
    modulesPaths = typeof modulesPaths === 'string' ? [modulesPaths] : modulesPaths;
    const locatorModule = new Module('locator-module');
    locatorModule.filename = 'locator-module.js';
    const requireFn = locatorModule.require.bind(locatorModule);

    const source = modulesPaths.map(feature => `require(${JSON.stringify(resolveFrom(basePath, feature))});`).join('');
    try {
        // tslint:disable-next-line:function-constructor
        const evalModule = new Function('module', 'exports', 'require', source);
        evalModule(locatorModule, locatorModule.exports, requireFn);
    } catch (e) {
        throw e;
    }
    return locatorModule;
}
