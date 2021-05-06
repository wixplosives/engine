import type webpack from 'webpack';

const resourceMatcher = /^\?generate-loader-(\w+)$/g;

interface WebpackLoaderContext {
    /**
     * Add a directory as dependency of the loader result.
     * https://github.com/webpack/loader-runner/blob/6221befd031563e130f59d171e732950ee4402c6/lib/LoaderRunner.js#L305
     */
    addContextDependency(context: string): void;
    /** https://github.com/webpack/webpack/blob/49890b77aae455b3204c17fdbed78eeb47bc1d98/lib/NormalModule.js#L472 */
    getOptions(schema?: any): GenerateFileConfigurationOptions;
    /**
     * Hacky access to the Module object being loaded.
     * https://github.com/TypeStrong/ts-loader/blob/e3a30c090a90ffc4f2bb21ed1d08ea98f361ac25/src/interfaces.ts#L346
     */
    _module: webpack.NormalModule;
}

interface GenerateFileConfigurationOptions {
    generate: (ctx: WebpackLoaderContext) => string;
}

export default function loader(this: WebpackLoaderContext) {
    const options = this.getOptions();
    return options.generate(this);
}

export function configLoader(options: GenerateFileConfigurationOptions) {
    return {
        loader: __filename,
        options,
        resourceQuery: resourceMatcher,
    };
}

export function virtualEntry(filename: string, id = 'entry') {
    return `${filename}?generate-loader-${id}!=!${__filename}`;
}
