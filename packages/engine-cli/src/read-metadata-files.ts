import fs from '@file-services/node';
import { createFeatureEnvironmentsMapping } from '@wixc3/engine-runtime-node';
import { createAllValidConfigurationsEnvironmentMapping } from '@wixc3/engine-scripts';
import { join } from 'node:path';

export function readMetadataFiles(dir: string) {
    const featureEnvironmentsMapping = fs.readJsonFileSync(
        join(dir, 'node', 'engine-feature-environments-mapping.json'),
    ) as ReturnType<typeof createFeatureEnvironmentsMapping>;
    const configMapping = fs.readJsonFileSync(join(dir, 'node', 'engine-config-mapping.json')) as ReturnType<
        typeof createAllValidConfigurationsEnvironmentMapping
    >;
    return { featureEnvironmentsMapping, configMapping };
}
