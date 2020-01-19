import { COM, TopLevelConfig } from '@wixc3/engine-core';
import express from 'express';

export function createConfigMiddleware(
    topology: Map<string, Record<string, string>>,
    publicPath?: string
): (config: TopLevelConfig) => express.RequestHandler {
    return (overrideConfig?: TopLevelConfig) => {
        return async (req, res) => {
            const { feature: reqFeature } = req.query;
            const config: TopLevelConfig = [COM.use({ config: { topology: topology.get(reqFeature), publicPath } })];
            if (overrideConfig?.length) {
                config.push(...overrideConfig);
            }

            res.send(config);
        };
    };
}
