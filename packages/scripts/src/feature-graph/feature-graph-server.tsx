import express from 'express';

import type { IFeatureDefinition } from '../types';
import fs from 'fs';
import type { Feature } from '@wixc3/engine-core/src';

const ASSETS_PATH = 'packages/scripts/src/feature-graph/assets';

export interface Node {
    id: string;
    name: string;
}

export interface Link {
    source: string;
    target: string;
}

const getFeatureLinks = (
    topLevelFeaturesMap: Map<string, IFeatureDefinition>,
    feature: string,
    visitedFeatures: Array<string>
): Array<Link> => {
    const res = [] as Array<Link>;
    const deps = topLevelFeaturesMap.get(feature)?.dependencies || [];
    for (const dep of deps) {
        res.push({ source: feature, target: dep });
        if (visitedFeatures.indexOf(feature) === -1) {
            visitedFeatures.push(dep);
            getFeatureLinks(topLevelFeaturesMap, dep, visitedFeatures);
        }
    }
    return res;
};

const getFeatureLinks2 = (feature: Feature, visitedFeatures: Array<string>): Array<Link> => {
    const res = [] as Array<Link>;
    const deps = feature.dependencies;
    for (const dep of deps) {
        res.push({ source: feature.id, target: dep.id });
        if (visitedFeatures.indexOf(dep.id) === -1) {
            visitedFeatures.push(dep.id);
            res.push(...getFeatureLinks2(dep, visitedFeatures));
        }
    }
    return res;
};

export const startServer = (features: Map<string, IFeatureDefinition>, featureName: string) => {
    // const nodes = [] as Array<Node>;
    // for (const feature of features.keys()) {
    //     nodes.push({ name: feature, id: feature });
    // }

    const server = express();

    server.use(express.static(ASSETS_PATH));

    server.get('/all', (req, res) => {
        const keys = [] as Array<string>;
        for (const key of features.keys()) {
            keys.push(key);
        }
        res.send(`
            <!DOCTYPE html>
            <html>
                <body>
                    <ul>
                    ${keys.map((key) => `<li><a href="/feature?feature-name=${key}">${key}</a></li>`).join('')}
                    </ul>
                </body>
            </html>
        `);
    });

    server.get('/feature', (req, res) => {
        const visitedFeatures = [] as Array<string>;
        const featureName = req.query['feature-name'] as string;
        const links = getFeatureLinks2(features.get(featureName)!.exportedFeature, visitedFeatures);

        fs.writeFileSync(
            `${ASSETS_PATH}/data.json`,
            JSON.stringify(
                {
                    nodes: visitedFeatures
                        .concat(features.get(featureName)!.exportedFeature.id)
                        .map((name) => ({ name, id: name })),
                    links,
                },
                null,
                2
            )
        );
        res.redirect(`/index.html`);
    });

    server.listen(8080, () => {
        console.log('server listening at localhost:8080');
    });
};
