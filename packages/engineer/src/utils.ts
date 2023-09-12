import { nodeFs as fs } from '@file-services/node';
import { defaults } from '@wixc3/common';
import { BaseHost, RuntimeEngine, RuntimeFeature } from '@wixc3/engine-core';
import { runNodeEnvironment } from '@wixc3/engine-runtime-node';
import { isFeatureFile, loadFeaturesFromPaths, type EngineConfig } from '@wixc3/engine-scripts';
import { TargetApplication } from './application-proxy-service.js';
import devServerFeature, { devServerEnv } from './feature/dev-server.feature.js';
import type { DevServerConfig } from './feature/dev-server.types.js';
import guiFeature from './feature/gui.feature.js';
import {
    defaultOptions,
    defaultsEngineConfig,
    type DEngineConfig,
    type DStartOptions,
    type IStartOptions,
} from './utils.types.js';

const basePath = fs.join(__dirname, './feature');

export async function startDevServer(options: IStartOptions): Promise<{
    engine: RuntimeEngine;
    devServerFeature: RuntimeFeature<typeof devServerFeature, typeof devServerEnv>['api'];
    outputPath: string | undefined;
}> {
    const serverOpts = defaults(options, defaultOptions);
    const app = new TargetApplication({
        basePath: serverOpts.targetApplicationPath,
    });
    const { config } = await app.getEngineConfig();
    const engineCnf = defaults(config || ({} as EngineConfig), defaultsEngineConfig);
    const featurePaths = options.devServerOnly
        ? // include only dev-server.feature
          fs.join(basePath, 'dev-server.feature.ts')
        : // include all features (gui, managed etc)
          fs.findFilesSync(basePath, {
              filterFile: ({ name }) => isFeatureFile(name),
          });
    await preRequire([...serverOpts.pathsToRequire, ...engineCnf.require], basePath);

    const { features } = await loadFeaturesFromPaths(
        { files: new Set(featurePaths), dirs: new Set([basePath]) },
        fs,
        undefined,
        undefined,
        engineCnf.extensions,
        engineCnf.conditions,
    );

    const engine = await runNodeEnvironment({
        featureName: serverOpts.engineerEntry,
        features: [...features],
        bundlePath: app.outputPath,
        name: devServerEnv.env,
        type: 'node',
        host: new BaseHost(),
        config: [
            devServerFeature.use({
                devServerConfig: asDevConfig(serverOpts, engineCnf),
            }),
            ...(options.devServerOnly
                ? []
                : [
                      guiFeature.use({
                          engineerConfig: {
                              features,
                          },
                      }),
                  ]),
        ],
        context: serverOpts.targetApplicationPath,
        env: devServerEnv,
        options: Object.entries(serverOpts.runtimeOptions),
    });
    return {
        engine,
        outputPath: app.outputPath,
        devServerFeature: engine.get(devServerFeature).api,
    };
}

function asDevConfig(options: DStartOptions, engineConfig: DEngineConfig): Partial<DevServerConfig> {
    return {
        ...options,
        favicon: options.favicon ?? engineConfig.favicon,
        basePath: options.targetApplicationPath,
        defaultRuntimeOptions: options.runtimeOptions,
        featureDiscoveryRoot: options.featureDiscoveryRoot ?? engineConfig.featureDiscoveryRoot,
    };
}

async function preRequire(pathsToRequire: string[], basePath: string) {
    for (const request of pathsToRequire) {
        const resolvedRequest = require.resolve(request, { paths: [basePath] });
        await import(resolvedRequest);
    }
}
