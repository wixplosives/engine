import guiFeature, { mainDashboardEnv } from './gui.feature';
import { devServerEnv } from './dev-server.feature';

import fs from '@file-services/node';
import type webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { createEntrypoint, IConfigDefinition } from '@wixc3/engine-scripts';
import { SetMultiMap } from '@wixc3/engine-core';

guiFeature.setup(
    devServerEnv,
    (
        { engineerConfig: { features } },
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

        const { plugins: basePlugins = [] } = baseConfig;
        const entryPath = fs.join(__dirname, 'main-dashboard-web-entry.js');
        const configurations = new SetMultiMap<string, IConfigDefinition>();

        virtualModules[entryPath] = createEntrypoint({
            features,
            childEnvs: [],
            envName: mainDashboardEnv.env,
            mode: 'development',
            publicConfigsRoute,
            staticBuild: false,
            configurations,
            featureName: 'engineer/gui',
        });

        engineerWebpackConfigs.register(
            createDashboardConfig({
                baseConfig,
                entryPath,
                basePlugins,
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
    basePlugins,
    virtualModules,
    title,
    outputPath,
}: {
    baseConfig: webpack.Configuration;
    entryPath: string;
    basePlugins: webpack.Plugin[];
    virtualModules: Record<string, string>;
    title?: string;
    outputPath: string;
}): webpack.Configuration {
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
    };
}
