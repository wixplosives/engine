import type { IRunOptions, TopLevelConfig } from '@wixc3/engine-core';
declare global {
    interface Window {
        engineEntryOptions?: (options: { urlParams: IRunOptions; envName: string }) => IRunOptions;
    }
}

export type ConfigLoader = () => Promise<
    {
        default: TopLevelConfig;
    }[]
>;

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
        if (!(globalThis instanceof Window)) {
            return false;
        }
        const win = globalThis as unknown as Window;
        return win.parent === win;
    }

    async importConfig(configName = '') {
        const loader = this.loaders[configName];
        if (!loader || !configName) {
            return Promise.resolve([]);
        }
        const res = await loader();
        const allLoadedConfigs = await Promise.all(res.map((module) => module.default));
        return allLoadedConfigs.flat();
    }

    getEntryOptions(): IRunOptions {
        const win = this.getWindow();
        if (!win) {
            throw new Error('Cannot get entry options, window is not defined');
        }
        const urlParams = new URLSearchParams(win.location.search);
        return win.engineEntryOptions?.({ urlParams, envName: this.envName }) ?? urlParams;
    }

    installChildEnvConfigFetcher(publicConfigsRoute: string, featureName: string, configName: string) {
        if (!publicConfigsRoute || !this.isMainWebEntrypoint()) {
            return;
        }
        globalThis.addEventListener('message', ({ data: { id, envName }, source }: MessageEvent) => {
            if (!source || id !== publicConfigsRoute) {
                return;
            }
            this.fetchConfig(publicConfigsRoute, envName, featureName, configName)
                .then((config) => {
                    source?.postMessage({
                        id,
                        config,
                    });
                })
                .catch((e) => {
                    source?.postMessage({
                        id,
                        error: String(e),
                    });
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
        const win = this.getWindow();
        if (!win) {
            throw new Error('Cannot load configuration from parent, window is not defined');
        }
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
                        win.removeEventListener('message', configsHandler);
                        error ? rej(error) : res(config);
                    }
                };
                win.addEventListener('message', configsHandler);
                win.parent.postMessage(
                    {
                        id: publicConfigsRoute,
                        envName: envName,
                    },
                    '*'
                );
            });
            this.fetchedConfigs[envName] = promise;
        }
        return promise;
    }

    private getWindow() {
        return globalThis instanceof Window ? (globalThis as unknown as Window) : null;
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
