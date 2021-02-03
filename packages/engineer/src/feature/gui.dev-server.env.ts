import type webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import fs from '@file-services/node';
import { SetMultiMap } from '@wixc3/engine-core';
import { createMainEntrypoint, IConfigDefinition } from '@wixc3/engine-scripts';
import guiFeature, { mainDashboardEnv } from './gui.feature';
import { devServerEnv } from './dev-server.feature';

guiFeature.setup(
    devServerEnv,
    (
        { engineerConfig: { features, externalFeatures } },
        {
            buildFeature: {
                engineerWebpackConfigs,
                devServerConfig: { title, publicConfigsRoute },
                serverListeningHandlerSlot,
                application,
            },
        }
    ) => {
        const baseConfigPath = fs.findClosestFileSync(__dirname, 'webpack.config.js');
        const baseConfig = (typeof baseConfigPath === 'string' ? require(baseConfigPath) : {}) as webpack.Configuration;
        const virtualModules: Record<string, string> = {};

        const entryPath = fs.join(__dirname, 'main-dashboard-web-entry.js');
        const configurations = new SetMultiMap<string, IConfigDefinition>();

        virtualModules[entryPath] = createMainEntrypoint({
            features,
            childEnvs: [],
            envName: mainDashboardEnv.env,
            mode: 'development',
            publicConfigsRoute,
            staticBuild: false,
            configurations,
            featureName: 'engineer/gui',
            target: 'web',
            externalFeatures,
        });

        engineerWebpackConfigs.register(
            createDashboardConfig({
                baseConfig,
                entryPath,
                virtualModules,
                title,
                outputPath: application.outputPath,
            })
        );

        serverListeningHandlerSlot.register(({ port, host }) => {
            console.log(`Dashboard Listening:`);
            console.log(`Dashboard URL: http://${host}:${port}/${mainDashboardEnv.env}.html`);
        });
    }
);

function createDashboardConfig({
    baseConfig,
    entryPath,
    virtualModules,
    title,
    outputPath,
}: {
    baseConfig: webpack.Configuration;
    entryPath: string;
    virtualModules: Record<string, string>;
    title?: string;
    outputPath: string;
}): webpack.Configuration {
    const { plugins: basePlugins = [] } = baseConfig;

    return {
        ...baseConfig,
        entry: {
            index: entryPath,
        },
        target: 'web',
        plugins: [
            ...basePlugins,
            new HtmlWebpackPlugin({
                filename: `${mainDashboardEnv.env}.html`,
                chunks: ['index'],
                title,
            }),
            new VirtualModulesPlugin(virtualModules),
        ],
        mode: 'development',
        devtool: 'source-map',
        output: {
            ...baseConfig.output,
            path: outputPath,
            filename: `[name].web.js`,
            chunkFilename: `[name].web.js`,
        },
        stats: 'errors-warnings',
    };
}
