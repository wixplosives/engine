import fs from '@file-services/node';
import {
    ConfigurationEnvironmentMapping,
    FeatureEnvironmentMapping,
    createFeatureEnvironmentsMapping,
} from '@wixc3/engine-runtime-node';
import { createAllValidConfigurationsEnvironmentMapping } from '@wixc3/engine-scripts';
import { join } from 'node:path';
import { EntryPointsPaths, EntryPoints } from './create-entrypoints';

export function readMetadataFiles(dir: string) {
    try {
        const featureEnvironmentsMapping = fs.readJsonFileSync(
            join(dir, 'metadata', 'engine-feature-environments-mapping.json'),
        ) as ReturnType<typeof createFeatureEnvironmentsMapping>;
        const configMapping = fs.readJsonFileSync(join(dir, 'metadata', 'engine-config-mapping.json')) as ReturnType<
            typeof createAllValidConfigurationsEnvironmentMapping
        >;
        return { featureEnvironmentsMapping, configMapping };
    } catch (e) {
        return undefined;
    }
}

export function writeMetaFiles(
    dir: string,
    featureEnvironmentsMapping: FeatureEnvironmentMapping,
    configMapping: ConfigurationEnvironmentMapping,
) {
    const outDir = join(dir, 'metadata');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        join(outDir, 'engine-feature-environments-mapping.json'),
        JSON.stringify(featureEnvironmentsMapping, null, 2),
    );
    fs.writeFileSync(join(outDir, 'engine-config-mapping.json'), JSON.stringify(configMapping, null, 2));
}

export function writeEntryPoints(dir: string, { nodeEntryPoints, webEntryPoints }: EntryPoints): EntryPointsPaths {
    const outDirWeb = join(dir, 'entrypoints', 'web');
    const outDirNode = join(dir, 'entrypoints', 'node');
    fs.mkdirSync(outDirWeb, { recursive: true });
    fs.mkdirSync(outDirNode, { recursive: true });
    const webEntryPointsPaths = [];
    const nodeEntryPointsPaths = [];
    for (const [name, content] of webEntryPoints) {
        const path = join(outDirWeb, name);
        webEntryPointsPaths.push(path);
        fs.writeFileSync(path, content);
    }
    for (const [name, content] of nodeEntryPoints) {
        const path = join(outDirNode, name);
        nodeEntryPointsPaths.push(path);
        fs.writeFileSync(path, content);
    }
    return { webEntryPointsPaths, nodeEntryPointsPaths };
}

export function readEntryPoints(dir: string): (EntryPoints & EntryPointsPaths) | undefined {
    try {
        const webDir = join(dir, 'entrypoints', 'web');
        const nodeDir = join(dir, 'entrypoints', 'node');
        const webEntryPoints = readDirShallowIntoMap(webDir);
        const nodeEntryPoints = readDirShallowIntoMap(nodeDir);
        const webEntryPointsPaths = Array.from(webEntryPoints.keys()).map((name) => join(webDir, name));
        const nodeEntryPointsPaths = Array.from(nodeEntryPoints.keys()).map((name) => join(nodeDir, name));
        return { webEntryPoints, nodeEntryPoints, webEntryPointsPaths, nodeEntryPointsPaths };
    } catch (e) {
        return undefined;
    }
}

function readDirShallowIntoMap(dir: string) {
    return fs.readdirSync(dir).reduce((acc, name) => {
        acc.set(name, fs.readFileSync(join(dir, name), 'utf-8'));
        return acc;
    }, new Map<string, string>());
}
