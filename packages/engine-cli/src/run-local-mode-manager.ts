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
    const meta = { url: pathToFileURL(join(outputPath, 'node/')).href };

    const manager = new NodeEnvManager(
        meta,
        featureEnvironmentsMapping,
        configMapping,
        freshConfigLoading ? importFresh : undefined,
    );
    const { port } = await manager.autoLaunch(execRuntimeOptions, serverOptions);
    return { port, manager };
}
