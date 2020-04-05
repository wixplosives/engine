require('@ts-tools/node/r');
require('tsconfig-paths/register');

import { resolve } from 'path';
import fs from '@file-services/node';
import { resolvePackages, loadFeaturesFromPackages, runIPCEnvironment } from '@wixc3/engine-scripts';

const basePath = resolve('../');
const packages = resolvePackages(basePath);
const { features } = loadFeaturesFromPackages(packages, fs);

export default function runEnv() {
    return runIPCEnvironment({
        featureName: 'electron-app/example',
        features: [...features.entries()],
        name: 'server',
        type: 'node',
    }).catch(console.error);
}

runEnv().catch(console.error);
