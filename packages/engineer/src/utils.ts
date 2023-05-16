import fs from '@file-services/node';
import { EngineConfig, isFeatureFile, loadFeaturesFromPaths } from '@wixc3/engine-scripts';
import { RuntimeEngine, BaseHost, RuntimeFeature } from '@wixc3/engine-core';
import devServerFeature, { devServerEnv } from './feature/dev-server.feature';
import type { DevServerConfig } from './feature/dev-server.types';
import guiFeature from './feature/gui.feature';
import { defaultOptions, defaultsEngineConfig, DEngineConfig, DStartOptions, IStartOptions } from './utils.types';
import { defaults } from '@wixc3/common';
import { TargetApplication } from './application-proxy-service';
import { runNodeEnvironment } from '@wixc3/engine-runtime-node';

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
    preRequire([...serverOpts.pathsToRequire, ...engineCnf.require], basePath);

    const { features } = loadFeaturesFromPaths({ files: new Set(featurePaths), dirs: new Set([basePath]) }, fs);

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

function preRequire(pathsToRequire: string[], basePath: string) {
    for (const request of pathsToRequire) {
        const resolvedRequest = require.resolve(request, { paths: [basePath] });
        require(resolvedRequest);
    }
}
