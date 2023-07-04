import type { TopLevelConfig } from './index';

declare global {
    interface Window {
        engineEntryOptions?: (options: { urlParams: URLSearchParams; envName: string }) => URLSearchParams;
    }
}

export type ConfigModule = {
    default: TopLevelConfig;
};

export type ConfigLoader = () => Promise<ConfigModule[]>;

export type ConfigLoaders = Record<string, ConfigLoader>;

export class RuntimeConfigurations {
    fetchedConfigs: Record<string, Promise<TopLevelConfig>> = {};
    constructor(private envName: string, private publicConfigsRoute: string, private loaders: ConfigLoaders) {
        // validate args since we use this class in the entry point template code
        if (!envName) {
            throw new Error('envName must be provided');
        }
    }
    private isMainWebEntrypoint() {
        return this.getScope() === this.getOpenerMessageTarget();
    }

    async importConfig(configName: string) {
        const loader = this.loaders[configName];
        if (!loader || !configName) {
            return [];
        }
        const res = await loader();
        const allLoadedConfigs = await Promise.all(res.map((module) => module.default));
        return allLoadedConfigs.flat();
    }

    installChildEnvConfigFetcher(featureName: string, configName: string) {
        if (!this.publicConfigsRoute || !this.isMainWebEntrypoint()) {
            return;
        }
        globalThis.addEventListener('message', ({ data: { id, envName, __from }, source }) => {
            if (!source || id !== this.publicConfigsRoute) {
                return;
            }
            this.fetchConfig(envName, featureName, configName)
                .then((config) => {
                    // with our flow it can only be a window (currently)
                    (source as Window).postMessage(
                        {
                            id,
                            config,
                            __to: __from,
                        },
                        '*'
                    );
                })
                .catch((e) => {
                    // with our flow it can only be a window (currently)
                    (source as Window).postMessage(
                        {
                            id,
                            error: String(e),
                            __to: __from,
                        },
                        '*'
                    );
                });
        });
    }

    load(envName: string, featureName: string, configName: string) {
        if (!this.publicConfigsRoute) {
            return Promise.resolve([]);
        }
        return this.isMainWebEntrypoint()
            ? this.fetchConfig(envName, featureName, configName)
            : this.loadFromParent(envName);
    }

    private loadFromParent(envName: string) {
        const scope = this.getScope();
        let promise = this.fetchedConfigs[envName];
        if (!promise) {
            promise = new Promise((res, rej) => {
                const configsHandler = ({
                    data: { id, config, error },
                }: {
                    data:
                        | { id: string; config: TopLevelConfig; error: never }
                        | { id: string; config: never; error: string };
                }) => {
                    if (id === this.publicConfigsRoute) {
                        scope.removeEventListener('message', configsHandler);
                        error ? rej(error) : res(config);
                    }
                };
                scope.addEventListener('message', configsHandler);
                scope.parent.postMessage(
                    {
                        id: this.publicConfigsRoute,
                        envName: envName,
                        __from: this.envName,
                    },
                    '*'
                );
            });
            this.fetchedConfigs[envName] = promise;
        }
        return promise;
    }

    private getScope() {
        return typeof self !== 'undefined' ? self : window;
    }

    private getOpenerMessageTarget() {
        const current = typeof self !== 'undefined' ? self : window;
        return current.parent ?? current;
    }

    private fetchConfig(envName: string, featureName: string, configName: string) {
        let url = addTrailingSlashIfNotEmpty(this.publicConfigsRoute) + configName;
        url += '?env=' + envName;
        url += '&feature=' + featureName;
        let promise = this.fetchedConfigs[url];
        if (!promise) {
            promise = fetch(url).then((res) => res.json());
            this.fetchedConfigs[url] = promise;
        }
        return promise;
    }
}

function addTrailingSlashIfNotEmpty(route: string) {
    return route ? (route.endsWith('/') ? route : route + '/') : '';
}
