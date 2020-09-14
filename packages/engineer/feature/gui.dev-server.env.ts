import guiFeature, { mainDashboardEnv } from './gui.feature';
import { devServerEnv } from './dev-server.feature';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import fs from '@file-services/node';
import type webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { createEntrypoint } from '@wixc3/engine-scripts/src/create-entrypoint';
import { SetMultiMap } from '@wixc3/engine-core/src';
import type { IConfigDefinition } from '@wixc3/engine-scripts/src';

guiFeature.setup(
    devServerEnv,
    (
        _,
        {
            buildFeature: {
                engineerWebpackConfigs,
                devServerConfig: { basePath, title, publicConfigsRoute },
                serverListeningHandlerSlot,
                application,
                engineerConfig: { features },
            },
        }
    ) => {
        const baseConfigPath = fs.findClosestFileSync(basePath, 'webpack.config.js');
        const baseConfig: webpack.Configuration = typeof baseConfigPath === 'string' ? require(baseConfigPath) : {};
        const virtualModules: Record<string, string> = {};

        const { plugins: basePlugins = [] } = baseConfig;
        const entryPath = 'main-dashboard-web-entry.js';
        const configurations = new SetMultiMap<string, IConfigDefinition>();

        virtualModules[entryPath] = createEntrypoint({
            features,
            childEnvs: [],
            envName: mainDashboardEnv.env,
            mode: 'development',
            publicConfigsRoute,
            staticBuild: false,
            configurations,
        });

        const dashboardConfig: webpack.Configuration = {
            ...baseConfig,
            entry: {
                index: `./${entryPath}`,
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
                path: application.outputPath,
                filename: `[name].web.js`,
                chunkFilename: `[name].web.js`,
            },
        };

        engineerWebpackConfigs.register(dashboardConfig);

        serverListeningHandlerSlot.register(({ port, host }) => {
            const mainUrl = `http://${host}:${port}/`;
            console.log(`Dashboard Listening:`);
            console.log('Dashboard URL: ', mainUrl + `${mainDashboardEnv.env}.html`);
        });
    }
);
