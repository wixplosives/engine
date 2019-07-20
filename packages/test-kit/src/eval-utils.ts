import { CONFIG_FILENAME_HINT, CORE_PACKAGE } from '@wixc3/engine-scripts';
import { spy } from 'sinon';
import ts from 'typescript';

export const moduleExportsSymbol = Symbol('module.exports');
export const testModule = Symbol('test module');

/**
 * This function evaluate engine entry file and mock evaluation of:
 * - .config files
 * - CORE_PACKAGE
 * - URLSearchParams
 * - Partial location object,
 * It is only used for easy source testing for entry source generation
 */
export function evalEntry(entrySource: string, urlSearchParams: { [key: string]: string } = {}) {
    const engineRunSpy = spy();
    const engineCOMSpy = spy(obj => ['COM', obj]);
    const { moduleExports, requireCalls } = evalModule(
        entrySource,
        (id: string) => {
            if (id.indexOf(CONFIG_FILENAME_HINT) !== -1) {
                return [id];
            }
            switch (id) {
                case CORE_PACKAGE:
                    return {
                        run: engineRunSpy,
                        COM: {
                            use: engineCOMSpy
                        }
                    };
                    break;
                default:
                    return undefined;
                    break;
            }
        },
        new Map(Object.entries(urlSearchParams))
    );
    return {
        moduleExportsSymbol,
        moduleExports: moduleExports as { default?: Promise<void> },
        getRequireCalls() {
            return requireCalls.map(call => {
                return call.id;
            });
        },
        getTopLevelConfig() {
            if (engineRunSpy.callCount !== 1) {
                throw new Error('engine run does not called exactly once');
            }
            return engineRunSpy.lastCall.args[1].map((_exports: any) => {
                return _exports[testModule] ? _exports.id : _exports;
            });
        },
        getRunningFeatures() {
            if (engineRunSpy.callCount !== 1) {
                throw new Error('engine run does not called exactly once');
            }
            return engineRunSpy.lastCall.args[0].map((_exports: any) => {
                return _exports[testModule] ? _exports.id : _exports;
            });
        }
    };
}

export function evalModule(
    source: string,
    requireHook?: (id: string) => unknown,
    urlParams: Map<string, string> = new Map()
) {
    const { outputText } = ts.transpileModule(source, {
        reportDiagnostics: false,
        compilerOptions: {
            target: ts.ScriptTarget.ES2018,
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true
        }
    });

    // tslint:disable-next-line:function-constructor
    const runCode = new Function('module', 'exports', 'require', 'URLSearchParams', 'location', outputText);
    const requireCalls: Array<{ id: string; [moduleExportsSymbol]: unknown }> = [];

    const _module = {
        exports: {}
    };

    const internalRequireHook = (id: string) => {
        let _moduleExports = requireHook ? requireHook(id) : undefined;
        if (_moduleExports === undefined) {
            _moduleExports = { id, [testModule]: true };
        }
        requireCalls.push({ id, [moduleExportsSymbol]: _moduleExports });
        return _moduleExports;
    };
    class URLSearchParams {
        constructor() {
            return urlParams;
        }
    }
    runCode(_module, _module.exports, internalRequireHook, URLSearchParams, {
        __NOT_REAL_LOCATION__: true
    });

    return {
        moduleExportsSymbol,
        moduleExports: _module.exports,
        requireCalls
    };
}
