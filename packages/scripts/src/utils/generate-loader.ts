import type webpack from 'webpack';

const resourceMatcher = ;
const virtualModules: Record<string, string> = {};
interface WebpackLoaderContext {
    /**
     * Add a directory as dependency of the loader result.
     * https://github.com/webpack/loader-runner/blob/6221befd031563e130f59d171e732950ee4402c6/lib/LoaderRunner.js#L305
     */
    addContextDependency(context: string): void;
    /**
     * Hacky access to the Module object being loaded.
     * https://github.com/TypeStrong/ts-loader/blob/e3a30c090a90ffc4f2bb21ed1d08ea98f361ac25/src/interfaces.ts#L346
     */
    _module: webpack.NormalModule;
    rootContext: string;
    resourceQuery: string;
}

export default function loader(this: WebpackLoaderContext) {
    this.addContextDependency(this.rootContext);
    this._module.context = this.rootContext;

    // The query comes with the ? - we need to slice it out
    const fileName = this.resourceQuery.slice(1);
    const generatedModule = virtualModules[fileName];
    if (generatedModule === undefined) {
        throw new Error(`No content was generated for virtual module ${this.resourceQuery}`);
    }

    // The virtual module is no longer needed once it's loaded into the module system
    // No reason to keep on holding it
    delete virtualModules.fileName;
    return generatedModule;
}

export function configVirtualModuleLoader() {
    return {
        loader: __filename,
        // Need to provide an options key to webpack, but we don't have any
        // So just pass an empty object
        options: {},
        resourceQuery: /^\?generate-loader-(\w+)$/g,
    };
}

export function virtualEntry(filename: string, id = 'entry') {
    return `${filename}?generate-loader-${id}!=!${__filename}?${filename}`;
}

export function addVirtualModule(moduleName: string, content: string) {
    virtualModules[moduleName] = content;
}
