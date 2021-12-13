import importFresh from 'import-fresh';
import type express from 'express';

import { COM, TopLevelConfig, SetMultiMap } from '@wixc3/engine-core';
import {
    findAllConfigs,
    DefaultConfigFileExports,
    IConfigDefinition,
    NodeEnvironmentsManager,
    TopLevelConfigProvider,
} from '@wixc3/engine-runtime-node';

export interface OverrideConfig {
    configName?: string;
    overrideConfig: TopLevelConfig;
}

export function createLiveConfigsMiddleware(
    configurations: SetMultiMap<string, IConfigDefinition | TopLevelConfig>,
    basePath: string,
    overrideConfigMap: Map<string, OverrideConfig>
): express.RequestHandler {
    return async (req, res, next) => {
        const config: TopLevelConfig = [];
        const { env: reqEnv } = req.query;
        const overrideConfig: TopLevelConfig = [];

        let requestedConfig: string | undefined = req.path.slice(1);
        requestedConfig = requestedConfig === 'undefined' ? undefined : requestedConfig;

        if (requestedConfig) {
            const currentOverrideConfig = overrideConfigMap.get(requestedConfig);
            if (currentOverrideConfig) {
                overrideConfig.push(...currentOverrideConfig.overrideConfig);
                requestedConfig = currentOverrideConfig.configName;
            }

            config.push(
                ...(await findAllConfigs({
                    basePath,
                    configurations,
                    requestedConfigName: requestedConfig!,
                    requestedEnvName: reqEnv as string | undefined,
                    importConfig: (filePath) => importFresh<DefaultConfigFileExports>(filePath).default,
                }))
            );
        }
        (res.locals as { topLevelConfig: TopLevelConfig[] }).topLevelConfig = (
            res.locals as {
                topLevelConfig: TopLevelConfig[];
            }
        ).topLevelConfig.concat(config, overrideConfig);
        next();
    };
}

export function createCommunicationMiddleware(
    nodeEnvironmentsManager: NodeEnvironmentsManager,
    publicPath?: string,
    topologyOverrides?: (featureName: string) => Record<string, string> | undefined
): express.RequestHandler {
    return (req, res, next) => {
        const { feature } = req.query;
        const requestedConfig: string | undefined = req.path.slice(1);
        const topology =
            typeof feature === 'string'
                ? topologyOverrides && topologyOverrides(feature)
                    ? topologyOverrides(feature)
                    : nodeEnvironmentsManager.getTopology(
                          feature,
                          requestedConfig === 'undefined' ? undefined : requestedConfig
                      )
                : undefined;
        (res.locals as { topLevelConfig: TopLevelConfig[] }).topLevelConfig = (
            res.locals as {
                topLevelConfig: TopLevelConfig[];
            }
        ).topLevelConfig.concat([
            COM.use({
                config: {
                    topology,
                    publicPath,
                },
            }),
        ]);
        next();
    };
}

export const createConfigMiddleware: (
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider
) => express.RequestHandler =
    (overrideConfig = []) =>
    (req, res) => {
        const { env: reqEnv } = req.query;
        res.send(
            (res.locals as { topLevelConfig: TopLevelConfig[] }).topLevelConfig.concat(
                Array.isArray(overrideConfig) ? overrideConfig : reqEnv ? overrideConfig(reqEnv as string) : []
            )
        );
    };

export const ensureTopLevelConfigMiddleware: express.RequestHandler = (_, res, next) => {
    if (!res.locals.topLevelConfig) {
        res.locals.topLevelConfig = [];
    }
    next();
};
