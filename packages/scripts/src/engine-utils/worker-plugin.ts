// tslint:disable: no-var-requires
import webpack from 'webpack';

const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const WebWorkerTemplatePlugin = require('webpack/lib/webworker/WebWorkerTemplatePlugin');

export interface WorkerPluginOptions {
    id: string;
    entry: string;
    filename: string;
    chunkFilename: string;
    plugins?: webpack.Plugin[];
}

export class WorkerEntryPointPlugin {
    constructor(private options: WorkerPluginOptions) {}
    public apply(compiler: webpack.Compiler) {
        const { id, entry, filename, chunkFilename, plugins = [] } = this.options;
        // const compilerHook = this.getCompilerHook(compiler, this.options)
        compiler.hooks.make.tapAsync(
            'WorkerEntryPointPlugin',
            (compilation: webpack.compilation.Compilation, callback: () => void) => {
                const outputOptions = {
                    filename,
                    chunkFilename,
                    publicPath: compilation.outputOptions.publicPath,
                    // HACK: globalObject is necessary to fix https://github.com/webpack/webpack/issues/6642
                    globalObject: `(typeof self !== 'undefined' ? self : this)`
                };
                const childCompiler = (compilation as any).createChildCompiler(id, outputOptions, [
                    new WebWorkerTemplatePlugin(),
                    new LoaderTargetPlugin('webworker')
                ]);
                new SingleEntryPlugin(compiler.options.context, entry, 'main').apply(childCompiler);
                plugins.forEach(plugin => plugin.apply(childCompiler));

                childCompiler.runAsChild(callback);
            }
        );
    }
}
