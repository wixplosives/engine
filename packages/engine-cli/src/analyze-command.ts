import { nodeFs as fs } from '@file-services/node';
import { EngineConfig, analyzeFeatures } from '@wixc3/engine-scripts';

export async function analyzeCommand({
    engineConfig,
    rootDir,
    feature,
}: {
    engineConfig: EngineConfig;
    rootDir: string;
    feature?: string;
}) {
    const { extensions, buildConditions, featureDiscoveryRoot } = engineConfig;

    const { features } = await analyzeFeatures(fs, rootDir, featureDiscoveryRoot, feature, extensions, buildConditions);
    const htmlTemplate = fs.readFileSync(fs.join(__dirname, 'dashboard/feature-walker.html'), 'utf8');
    const replaceString = 'globalThis.EMBEDDED_DATA = new Map();';
    if (!htmlTemplate.includes(replaceString)) {
        throw new Error(`Cannot find "${replaceString}" in the feature-walker.html template`);
    }

    fs.writeFileSync(fs.join(rootDir, 'analyze.features.json'), JSON.stringify(Array.from(features), null, 2));
    fs.writeFileSync(
        fs.join(rootDir, 'analyze.features.html'),
        htmlTemplate.replace(
            replaceString,
            `globalThis.EMBEDDED_DATA = new Map(${JSON.stringify(Array.from(features))});`,
        ),
    );
}
