import type webpack from 'webpack';

const hasOwnProperty = Object.prototype.hasOwnProperty;

export interface VirtualModulesLoaderOptions {
    [fileName: string]: string;
}

const virtualModulesLoader: webpack.LoaderDefinition = function () {
    const options = this.getOptions() as VirtualModulesLoaderOptions;
    const match = /^\?id=(.*)$/.exec(this.resourceQuery);
    if (!match) {
        throw new Error(`invalid resourceQuery: ${this.resourceQuery}`);
    }
    const fileName = match[1]!;
    if (!options[fileName]) {
        throw new Error(`missing generator for: ${fileName}`);
    }
    if (this._module) {
        this._module.context = this.rootContext;
    }
    return options[fileName]!;
};

export default virtualModulesLoader;

export function createVirtualEntries(options: VirtualModulesLoaderOptions) {
    const entries: webpack.EntryObject = {};
    for (const entry of Object.keys(options)) {
        entries[entry] = `${entry}!=!${__filename}?id=${entry}`;
    }
    return {
        entries,
        loaderRule: {
            loader: __filename,
            options,
            test(entry: string) {
                return hasOwnProperty.call(options, entry);
            },
        },
    };
}
