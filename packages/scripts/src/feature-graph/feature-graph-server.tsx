import express from 'express';

import type { IFeatureDefinition } from '../types';
import fs from 'fs';
import type { Feature } from '@wixc3/engine-core/src';

const ASSETS_PATH = 'packages/scripts/src/feature-graph/assets';
import template from './assets/template';
import rendererTemplate from './assets/renderer';
import { App } from './assets/App';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { features } from 'process';

export interface Node {
    id: string;
    name: string;
    level: number;
}

export interface Link {
    source: string;
    target: string;
}

const getFeatureLinks = (
    feature: Feature,
    visitedFeatures: { [propName: string]: number },
    level: number
): Array<Link> => {
    const res = [] as Array<Link>;
    const deps = feature.dependencies;
    for (const dep of deps) {
        res.push({ source: feature.id, target: dep.id });
        if (!(dep.id in visitedFeatures)) {
            visitedFeatures[dep.id] = level + 1;
            res.push(...getFeatureLinks(dep, visitedFeatures, level++));
        }
    }
    return res;
};

const bfsFeatureLinks = (
    entry: Feature,
    visitedFeatures: { [propName: string]: number },
    level: number
): Array<Link> => {
    const res = [] as Array<Link>;
    const deps = entry.dependencies;
    for (const dep of deps) {
        res.push({ source: entry.id, target: dep.id });
        if (!(dep.id in visitedFeatures)) {
            visitedFeatures[dep.id] = level + 1;
        }
    }
    for (const dep of deps) {
        if (visitedFeatures[dep.id] === level + 1) {
            res.push(...bfsFeatureLinks(dep, visitedFeatures, level + 1));
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

    server.get('/old', (req, res) => {
        const keys = [] as Array<string>;
        for (const key of features.keys()) {
            keys.push(key);
        }

        res.send(`
        <!DOCTYPE html>
        <html>
            <body style="display: flex; width: 100vw; height: 100vh">
                <aside>
                    <ul>
                        ${keys.map((key) => `<li><a href="/feature?feature-name=${key}">${key}</a></li>`).join('')}
                    </ul>
                </aside>
                <main style="flex: 1"><iframe src="renderer.html" width="100%" height="100%"></iframe></main>
            </body>
        </html>
        `);
    });

    const discoveredFeatures = [] as Array<string>;
    for (const key of features.keys()) {
        discoveredFeatures.push(key);
    }

    server.get('/', (req, res) => {
        const featureName = req.query['feature-name'] as string;
        const appString = renderToString(<App features={discoveredFeatures} currentFeature={featureName} />);

        res.send(
            template({
                body: appString,
                title: featureName,
            })
        );
    });

    server.get('/renderer', (req, res) => {
        const featureName = req.query['feature-name'] as string;

        const visitedFeatures = {} as { [propName: string]: number };

        const links = bfsFeatureLinks(features.get(featureName)!.exportedFeature, visitedFeatures, 0);

        const graph = {
            nodes: Object.keys(visitedFeatures)
                .map((name) => ({ name, id: name, group: visitedFeatures[name] }))
                .concat({
                    name: features.get(featureName)!.exportedFeature.id,
                    id: features.get(featureName)!.exportedFeature.id,
                    group: 0,
                }),
            links,
        };
        res.send(rendererTemplate(graph));
    });

    server.listen(8080, () => {
        console.log('server listening at localhost:8080');
    });
};
