import {
    ConfigurationEnvironmentMapping,
    FeatureEnvironmentMapping,
    ILaunchHttpServerOptions,
    NodeEnvManager,
} from '@wixc3/engine-runtime-node';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importFresh } from './import-fresh.js';

export async function runLocalNodeManager(
    featureEnvironmentsMapping: FeatureEnvironmentMapping,
    configMapping: ConfigurationEnvironmentMapping,
    execRuntimeOptions: Map<string, string | boolean | undefined>,
    outputPath: string = 'dist-engine',
    serverOptions?: ILaunchHttpServerOptions,
) {
    const manager = new NodeEnvManager(
        { url: pathToFileURL(join(outputPath, 'node/')).href },
        featureEnvironmentsMapping,
        configMapping,
        (entryPoints: string[]) => importFresh(entryPoints, 'default'),
    );
    const { port } = await manager.autoLaunch(execRuntimeOptions, serverOptions);
    return { port, manager };
}
