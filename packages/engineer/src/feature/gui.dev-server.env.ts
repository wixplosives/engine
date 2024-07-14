import { nodeFs as fs } from '@file-services/node';
import { getOriginalModule, type IConfigDefinition } from '@wixc3/engine-runtime-node';
import { createMainEntrypoint, createVirtualEntries } from '@wixc3/engine-scripts';
import { SetMultiMap } from '@wixc3/patterns';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { pathToFileURL } from 'node:url';
import type webpack from 'webpack';
import { devServerEnv } from './dev-server.feature.js';
import guiFeature, { mainDashboardEnv } from './gui.feature.js';

guiFeature.setup(
    devServerEnv,
    (
        { run, engineerConfig: { features } },
        {
            buildFeature: {
                engineerWebpackConfigs,
                devServerConfig: { title, favicon, publicConfigsRoute, log },
                serverListeningHandlerSlot,
                application,
            },
        },
    ) => {
        run(async () => {
            const selfDirectoryPath = __dirname;
            const baseConfigPath = fs.findClosestFileSync(selfDirectoryPath, 'webpack.config.js');
            const baseConfig =
                typeof baseConfigPath === 'string'
                    ? (
                          getOriginalModule(await import(pathToFileURL(baseConfigPath).href)) as {
                              default: webpack.Configuration;
                          }
                      ).default
                    : {};
            const virtualModules: Record<string, string> = {};

            const configurations = new SetMultiMap<string, IConfigDefinition>();

            virtualModules['index'] = createMainEntrypoint({
                features,
                childEnvs: [],
                env: {
                    name: mainDashboardEnv.env,
                    env: mainDashboardEnv,
                    type: mainDashboardEnv.envType,
                },
                mode: 'development',
                publicConfigsRoute,
                staticBuild: false,
                configurations,
                featureName: 'engineer/gui',
                featuresBundleName: 'dashboard-features',
                absImports: true,
            });

            engineerWebpackConfigs.register(
                createDashboardConfig({
                    baseConfig,
                    virtualModules,
                    title,
                    favicon,
                    outputPath: application.outputPath,
                }),
            );

            if (log) {
                serverListeningHandlerSlot.register(({ port, host }) => {
                    console.log(`Dashboard Listening:`);
                    console.log(`Dashboard URL: http://${host}:${port}/dashboard`);
                });
            }
        });
    },
);

function createDashboardConfig({
    baseConfig,
    virtualModules,
    outputPath,
    title,
    favicon,
}: {
    baseConfig: webpack.Configuration;
    virtualModules: Record<string, string>;
    title?: string;
    favicon?: string;
    outputPath: string;
}): webpack.Configuration {
    const { module: baseModule = {}, plugins: basePlugins = [] } = baseConfig;
    const { rules: baseRules = [] } = baseModule;
    const { loaderRule, entries } = createVirtualEntries(virtualModules);

    return {
        ...baseConfig,
        mode: 'development',
        entry: entries,
        target: 'web',
        plugins: [
            ...basePlugins,
            new HtmlWebpackPlugin({
                filename: `${mainDashboardEnv.env}.html`,
                chunks: ['index'],
                title,
                favicon,
            }),
        ],
        module: { ...baseModule, rules: [...baseRules, loaderRule] },
        devtool: 'source-map',
        output: {
            ...baseConfig.output,
            publicPath: '/dashboard',
            path: outputPath,
            filename: `[name].web.js`,
            chunkFilename: `[name].web.js`,
        },
        stats: 'errors-warnings',
    };
}
