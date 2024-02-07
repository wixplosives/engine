import fs from '@file-services/node';
import {
    ConfigurationEnvironmentMapping,
    FeatureEnvironmentMapping,
    createFeatureEnvironmentsMapping,
} from '@wixc3/engine-runtime-node';
import { createAllValidConfigurationsEnvironmentMapping } from '@wixc3/engine-scripts';
import { join } from 'node:path';
import { EntryPoints } from './create-entrypoints';

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

export function writeEntryPoints(dir: string, { nodeEntryPoints, webEntryPoints }: EntryPoints) {
    const outDirWeb = join(dir, 'entrypoints-cache', 'web');
    const outDirNode = join(dir, 'entrypoints-cache', 'node');
    fs.mkdirSync(outDirWeb, { recursive: true });
    fs.mkdirSync(outDirNode, { recursive: true });
    for (const [name, content] of webEntryPoints) {
        fs.writeFileSync(join(outDirWeb, name), content);
    }
    for (const [name, content] of nodeEntryPoints) {
        fs.writeFileSync(join(outDirNode, name), content);
    }
}

export function readEntryPoints(dir: string): EntryPoints | undefined {
    try {
        const webEntryPoints = readDirShallowIntoMap(join(dir, 'entrypoints-cache', 'web'));
        const nodeEntryPoints = readDirShallowIntoMap(join(dir, 'entrypoints-cache', 'node'));
        return { webEntryPoints, nodeEntryPoints };
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
