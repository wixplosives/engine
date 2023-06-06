import type webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import fs from '@file-services/node';
import { SetMultiMap } from '@wixc3/patterns';
import { createMainEntrypoint, createVirtualEntries } from '@wixc3/engine-scripts';
import guiFeature, { mainDashboardEnv } from './gui.feature';
import { devServerEnv } from './dev-server.feature';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';

guiFeature.setup(
    devServerEnv,
    (
        { engineerConfig: { features } },
        {
            buildFeature: {
                engineerWebpackConfigs,
                devServerConfig: { title, favicon, publicConfigsRoute, log },
                serverListeningHandlerSlot,
                application,
            },
        }
    ) => {
        const baseConfigPath = fs.findClosestFileSync(__dirname, 'webpack.config.js');
        const baseConfig = (typeof baseConfigPath === 'string' ? require(baseConfigPath) : {}) as webpack.Configuration;
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
        });

        engineerWebpackConfigs.register(
            createDashboardConfig({
                baseConfig,
                virtualModules,
                title,
                favicon,
                outputPath: application.outputPath,
            })
        );

        if (log) {
            serverListeningHandlerSlot.register(({ port, host }) => {
                console.log(`Dashboard Listening:`);
                console.log(`Dashboard URL: http://${host}:${port}/dashboard`);
            });
        }
    }
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
