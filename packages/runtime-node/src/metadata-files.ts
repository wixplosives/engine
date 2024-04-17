import fs from '@file-services/node';
import {
    ConfigurationEnvironmentMapping,
    FeatureEnvironmentMapping,
    createFeatureEnvironmentsMapping,
} from '@wixc3/engine-runtime-node';
import { createAllValidConfigurationsEnvironmentMapping } from '@wixc3/engine-scripts';
import { join } from 'node:path';

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
