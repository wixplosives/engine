import type webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export class WebpackScriptAttributesPlugin implements webpack.WebpackPluginInstance {
    constructor(private options: { scriptAttributes: Record<string, string> }) {}

    public apply(compiler: webpack.Compiler) {
        compiler.hooks.compilation.tap(WebpackScriptAttributesPlugin.name, (compilation) => {
            HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tap(WebpackScriptAttributesPlugin.name, (tags) => {
                const {
                    assetTags: { scripts },
                } = tags;

                for (const tagObject of scripts) {
                    Object.assign(tagObject.attributes, this.options.scriptAttributes);
                }
                return tags;
            });
        });
    }
}
