import {
    ConfigurationEnvironmentMapping,
    FeatureEnvironmentMapping,
    ILaunchHttpServerOptions,
    NodeEnvManager,
} from '@wixc3/engine-runtime-node';
import { importFresh } from '@wixc3/engine-scripts';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function runLocalNodeManager(
    featureEnvironmentsMapping: FeatureEnvironmentMapping,
    configMapping: ConfigurationEnvironmentMapping,
    execRuntimeOptions: Map<string, string | boolean | undefined>,
    outputPath: string = 'dist-engine',
    freshConfigLoading = false,
    serverOptions?: ILaunchHttpServerOptions,
) {
    const manager = new NodeEnvManager(
        { url: pathToFileURL(join(outputPath, 'node/')).href },
        featureEnvironmentsMapping,
        configMapping,
        freshConfigLoading ? importFresh : undefined,
    );
    const { port } = await manager.autoLaunch(execRuntimeOptions, serverOptions);
    return { port, manager };
}
