import guiFeature from './gui.feature';
import { buildEnv } from './build.feature';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import fs from '@file-services/node';
import type webpack from 'webpack';

guiFeature.setup(
    buildEnv,
    (
        { run },
        {
            buildFeature: {
                engineerWebpackConfigs,
                devServerConfig: { basePath, httpServerPort, featureName },
                application,
            },
        }
    ) => {
        const engineDashboardEntry = require.resolve('packages/scripts/src/engine-dashboard');
        const baseConfigPath = fs.findClosestFileSync(basePath, 'webpack.config.js');
        const baseConfig: webpack.Configuration = typeof baseConfigPath === 'string' ? require(baseConfigPath) : {};
        const virtualModules: Record<string, string> = {};

        const { plugins: basePlugins = [] } = baseConfig;

        const dashboardConfig: webpack.Configuration = {
            ...baseConfig,
            entry: {
                engineer: engineDashboardEntry,
            },
            target: 'web',
            plugins: [
                ...basePlugins,
                new VirtualModulesPlugin(virtualModules),
                new HtmlWebpackPlugin({
                    filename: `index.html`,
                    chunks: ['engineer'],
                }),
            ],
            mode: 'development',
            devtool: 'source-map',
            output: {
                ...baseConfig.output,
                path: application.outputPath,
                filename: `[name].dashboard.js`,
                chunkFilename: `[name].dashboard.js`,
            },
        };

        engineerWebpackConfigs.register(dashboardConfig);

        run(() => {
            const mainUrl = `http://localhost:${httpServerPort}/`;
            console.log(`Listening:`);
            console.log('Dashboard URL: ', mainUrl);
            if (featureName) {
                console.log('Main application URL: ', `${mainUrl}main.html`);
            }
        });
    }
);
