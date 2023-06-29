import type { TopLevelConfig } from './index';

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace globalThis {
    const parent: typeof globalThis | undefined;
    const engineEntryOptions: (options: { urlParams: URLSearchParams; envName: string }) => URLSearchParams;
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
    public isMainEntrypoint() {
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
        if (!this.publicConfigsRoute || !this.isMainEntrypoint()) {
            return;
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('message', ({ data: { id, envName, from }, source }) => {
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
                                to: from,
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
                                to: from,
                            },
                            '*'
                        );
                    });
            });
        } else {
            console.log('installChildEnvConfigFetcher is not supported in this environment');
        }
    }

    load(envName: string, featureName: string, configName: string) {
        if (!this.publicConfigsRoute) {
            return Promise.resolve([]);
        }
        return this.isMainEntrypoint()
            ? this.fetchConfig(envName, featureName, configName)
            : this.loadFromParent(envName);
    }

    private loadFromParent(envName: string) {
        let promise = this.fetchedConfigs[envName];
        if (!promise) {
            promise = new Promise((res, rej) => {
                if (typeof window === 'undefined') {
                    return rej('loadFromParent is not supported in this environment ATM');
                }

                const configsHandler = ({
                    data: { id, config, error },
                }: {
                    data:
                        | { id: string; config: TopLevelConfig; error: never }
                        | { id: string; config: never; error: string };
                }) => {
                    if (id === this.publicConfigsRoute) {
                        window.removeEventListener('message', configsHandler);
                        error ? rej(error) : res(config);
                    }
                };
                window.addEventListener('message', configsHandler);
                window.parent.postMessage(
                    {
                        id: this.publicConfigsRoute,
                        envName: envName,
                        from: this.envName,
                    },
                    '*'
                );
            });
            this.fetchedConfigs[envName] = promise;
        }
        return promise;
    }

    private getScope() {
        return globalThis;
    }

    private getOpenerMessageTarget() {
        return globalThis.parent ?? globalThis;
    }

    private fetchConfig(envName: string, featureName: string, configName: string) {
        let promise = this.fetchedConfigs[envName];
        if (!promise) {
            let url = addTrailingSlashIfNotEmpty(this.publicConfigsRoute) + configName;
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

// function isNode() {
//     return typeof process !== 'undefined' && process.release && process.release.name === 'node';
// }
