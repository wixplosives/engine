import type { IRunOptions, TopLevelConfig } from './index';

declare global {
    interface Window {
        engineEntryOptions?: (options: { urlParams: URLSearchParams; envName: string }) => URLSearchParams;
    }
}

type ConfigModule = {
    default: TopLevelConfig;
};

export type ConfigLoader = () => Promise<ConfigModule[]>;

export type ConfigLoaders = Record<string, ConfigLoader>;

export class RuntimeConfigurations {
    fetchedConfigs: Record<string, Promise<TopLevelConfig>> = {};
    constructor(private envName: string, private loaders: ConfigLoaders) {
        // validate args since we use this class in the entry point template code
        if (!envName) {
            throw new Error('envName must be provided');
        }
    }
    private isMainWebEntrypoint() {
        return this.getScope() === this.getOpenerMessageTarget();
    }

    async importConfig(configName = '') {
        const loader = this.loaders[configName];
        if (!loader || !configName) {
            return [];
        }
        const res = await loader();
        const allLoadedConfigs = await Promise.all(res.map((module) => module.default));
        return allLoadedConfigs.flat();
    }

    getEntryOptions(): IRunOptions {
        const scope = self || this.getScope();
        const urlParams = new URLSearchParams(scope.location.search);
        return scope.engineEntryOptions?.({ urlParams, envName: this.envName }) ?? urlParams;
    }

    installChildEnvConfigFetcher(publicConfigsRoute: string, featureName: string, configName: string) {
        if (!publicConfigsRoute || !this.isMainWebEntrypoint()) {
            return;
        }
        globalThis.addEventListener('message', ({ data: { id, envName, from }, source }) => {
            if (!source || id !== publicConfigsRoute) {
                return;
            }
            this.fetchConfig(publicConfigsRoute, envName, featureName, configName)
                .then((config) => {
                    // with our flow it can only be a window (currently)
                    (source as Window).postMessage({
                        id,
                        config,
                        to: from,
                    }, '*');
                })
                .catch((e) => {
                    // with our flow it can only be a window (currently)
                    (source as Window).postMessage({
                        id,
                        error: String(e),
                        to: from,
                    }, '*');
                });
        });
    }

    load(publicConfigsRoute: string, envName: string, featureName: string, configName: string) {
        if (!publicConfigsRoute) {
            return Promise.resolve([]);
        }
        return this.isMainWebEntrypoint()
            ? this.fetchConfig(publicConfigsRoute, envName, featureName, configName)
            : this.loadFromParent(publicConfigsRoute, envName);
    }

    private loadFromParent(publicConfigsRoute: string, envName: string) {
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
                    if (id === publicConfigsRoute) {
                        scope.removeEventListener('message', configsHandler);
                        error ? rej(error) : res(config);
                    }
                };
                scope.addEventListener('message', configsHandler);
                this.getOpenerMessageTarget().postMessage(
                    {
                        id: publicConfigsRoute,
                        envName: envName,
                        from: this.envName
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

    private fetchConfig(publicConfigsRoute: string, envName: string, featureName: string, configName: string) {
        let promise = this.fetchedConfigs[envName];
        if (!promise) {
            let url = addTrailingSlashIfNotEmpty(publicConfigsRoute) + configName;
            url += '?env=' + envName;
            url += '&feature=' + featureName;
            promise = fetch(url).then((res) => res.json());
            this.fetchedConfigs[envName] = promise;
        }
        return promise;
    }
}

function addTrailingSlashIfNotEmpty(route: string) {
    return route ? (route.endsWith('/') ? route : route + '/') : '';
}
