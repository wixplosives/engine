import guiFeature from './gui.feature';
import { devServerEnv } from './dev-server.feature';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import fs from '@file-services/node';
import type webpack from 'webpack';

guiFeature.setup(
    devServerEnv,
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
        const engineDashboardEntry = require.resolve('../engine-dashboard/components/app.tsx');
        const baseConfigPath = fs.findClosestFileSync(basePath, 'webpack.config.js');
        const baseConfig: webpack.Configuration = typeof baseConfigPath === 'string' ? require(baseConfigPath) : {};
        const virtualModules: Record<string, string> = {};

        const { plugins: basePlugins = [] } = baseConfig;

        const dashboardConfig: webpack.Configuration = {
            ...baseConfig,
            entry: {
                index: engineDashboardEntry,
            },
            target: 'web',
            plugins: [...basePlugins, new VirtualModulesPlugin(virtualModules)],
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
