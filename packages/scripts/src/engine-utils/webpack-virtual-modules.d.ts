declare module 'webpack-virtual-modules' {
    type WebpackPlugin = import('webpack').Plugin;
    class VirtualModulesPlugin implements WebpackPlugin {
        constructor(files?: Record<string, string>);
        apply(): void;
    }

    export = VirtualModulesPlugin;
}
