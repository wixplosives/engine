import { createDisposables, TopLevelConfig } from '@wixc3/engine-core';
import isCI from 'is-ci';
import fs from '@file-services/node';
import playwright from 'playwright-core';
import type { PerformanceMetrics } from '@wixc3/engine-scripts';
import { AttachedApp } from './attached-app';
import { DetachedApp } from './detached-app';
import { ensureTracePath } from './utils';
import type { IExecutableApplication } from './types';
import { hookPageConsole } from './hook-page-console';

const cliEntry = require.resolve('@wixc3/engineer/bin/engineer');

export interface IWithFeatureOptionsBase {
    /**
     * feature file name scoped to feature root directory.
     * if feature name is the same as folder name, scoping is unnecessary.
     * @example given the following structure:
     *
     * --my-feature
     *   -- feature
     *      -- my-feature.feature.ts
     *      -- my-feature2.feature.ts
     *   -- fixtures
     *      -- my-feature-fixture.feature.ts
     * possible feature names will be:
     * `my-feature`
     * `my-feature/my-feature1`
     * `my-feature/my-feature-fixture`
     */
    featureName?: string;

    /**
     * configuration file name scoped to feature root directory.
     *
     * @example given the following structure:
     * --my-feature
     *   -- feature
     *      -- my-feature.feature.ts
     *      -- production.config.ts
     *   -- fixtures
     *      -- dev.config.ts
     * possible feature names will be:
     * `my-feature/production`
     * `my-feature/dev`
     *
     */
    configName?: string;

    /**
     * query parameters to open the page with
     */
    queryParams?: Record<string, string>;

    /**
     * runtime options that will be provided to the node environments
     */
    runOptions?: Record<string, string>;

    /**
     * Allows providing a Top level config
     * If configName was provided, the matching configurations will be overriden by the config provided
     */
    config?: TopLevelConfig;

    /** Passed down to `browser.newContext()` */
    browserContextOptions?: playwright.BrowserContextOptions;

    /**
     * If we want to test the engine against a running application, proveide the port of the application.
     * It can be extracted from the log printed after 'engineer start' or 'engine run'
     */
    runningApplicationPort?: number;

    /** Specify directory where features will be looked up within the package */
    featureDiscoveryRoot?: string;
}

export interface IWithFeatureOptions extends IWithFeatureOptionsBase, playwright.LaunchOptions {}

export interface Tracing {
    /**
     * path to the location of the trace file.
     * can be either the path to the file itself (include the .zip extension), or to the base directory where the file will be created
     * @default process.cwd()
     */
    outPath?: string;
    /**
     * should trace include screenshots
     * @default true
     */
    screenshots?: boolean;
    /**
     * should trace include snapshots
     * @default true
     */
    snapshots?: boolean;
    /**
     * name of the zip file if not provided in outPath
     */
    name?: string;
}

export interface IFeatureExecutionOptions
    extends Omit<IWithFeatureOptionsBase, 'runningApplicationPort' | 'featureDiscoveryRoot'> {
    tracing?: boolean | Tracing;
}

let browser: playwright.Browser | undefined = undefined;
let featureUrl = '';
let executableApp: IExecutableApplication;

if (typeof after !== 'undefined') {
    after('close browser, if open', async () => {
        if (browser && browser.isConnected) {
            await browser.close();
        }
        browser = undefined;
    });

    after('close engine server, if open', async function () {
        this.timeout(60_000);
        if (featureUrl) {
            await executableApp.closeServer();
            featureUrl = '';
        }
    });
}

export function withFeature(withFeatureOptions: IWithFeatureOptions = {}) {
    const disposeAfterEach = createDisposables();
    const {
        headless,
        devtools,
        slowMo,
        browserContextOptions: suiteBrowserContextOptions,
        featureName: suiteFeatureName,
        configName: suiteConfigName,
        runOptions: suiteOptions = {},
        queryParams: suiteQueryParams,
        runningApplicationPort,
        config: suiteConfig,
        featureDiscoveryRoot,
    } = withFeatureOptions;

    if (
        isCI &&
        (headless === false || devtools === true || slowMo !== undefined || runningApplicationPort !== undefined)
    ) {
        throw new Error(
            `withFeature was called with development time options in CI:\n${JSON.stringify(withFeatureOptions)}`
        );
    }

    const capturedErrors: Error[] = [];

    const resolvedPort =
        runningApplicationPort ??
        (process.env.ENGINE_APPLICATION_PORT ? parseInt(process.env.ENGINE_APPLICATION_PORT) : undefined);

    executableApp = resolvedPort
        ? new AttachedApp(resolvedPort)
        : new DetachedApp(cliEntry, process.cwd(), featureDiscoveryRoot);

    before('launch browser', async function () {
        if (!browser) {
            this.timeout(60_000); // 1 minute
            browser = await playwright.chromium.launch(withFeatureOptions);
        }
    });

    before('engineer start', async function () {
        if (!featureUrl) {
            this.timeout(60_000 * 4); // 4 minutes
            const port = await executableApp.getServerPort();
            featureUrl = `http://localhost:${port}/main.html`;
        }
    });

    afterEach(disposeAfterEach.dispose);

    const browserContexts = new Set<playwright.BrowserContext>();
    afterEach('close pages', async () => {
        for (const browserContext of browserContexts) {
            await browserContext.close();
        }
        browserContexts.clear();
    });
    afterEach('verify no page errors', () => {
        if (capturedErrors.length) {
            const errorsText = capturedErrors.join('\n');
            capturedErrors.length = 0;
            throw new Error(`there were uncaught page errors during the test:\n${errorsText}`);
        }
    });

    return {
        async getLoadedFeature(
            {
                featureName = suiteFeatureName,
                configName = suiteConfigName,
                runOptions = suiteOptions,
                queryParams = suiteQueryParams,
                config = suiteConfig,
                browserContextOptions = suiteBrowserContextOptions,
                tracing,
            }: IFeatureExecutionOptions = {},
            navigationOptions?: Parameters<playwright.Page['goto']>[1]
        ) {
            if (!browser) {
                throw new Error('Browser is not open!');
            }
            if (!executableApp) {
                throw new Error('Engine HTTP server is closed!');
            }

            const { configName: newConfigName } = await executableApp.runFeature({
                featureName,
                configName,
                runtimeOptions: runOptions,
                overrideConfig: config,
            });

            disposeAfterEach.add(async () =>
                executableApp.closeFeature({
                    featureName,
                    configName: newConfigName,
                })
            );

            const search = toSearchQuery({
                featureName,
                configName: newConfigName,
                queryParams,
            });

            const browserContext = await browser.newContext(browserContextOptions);
            if (tracing) {
                if (typeof tracing === 'boolean') {
                    tracing = {};
                }
                const { screenshots, snapshots, name, outPath } = {
                    ...tracing,
                    screenshots: true,
                    snapshots: true,
                    outPath: process.cwd(),
                };
                await browserContext.tracing.start({ screenshots, snapshots });
                disposeAfterEach.add(() =>
                    browserContext.tracing.stop({
                        path: ensureTracePath({ outPath, fs, name }),
                    })
                );
            }
            browserContexts.add(browserContext);
            browserContext.on('page', (page) => {
                page.setDefaultNavigationTimeout(30_000);
                page.setDefaultTimeout(10_000);
                page.on('pageerror', (e) => {
                    capturedErrors.push(e);
                    console.error(e);
                });
                hookPageConsole(page, isNonReactDevMessage);
            });

            const featurePage = await browserContext.newPage();

            const response = await featurePage.goto(featureUrl + search, {
                waitUntil: 'networkidle',
                ...navigationOptions,
            });

            async function getMetrics(): Promise<PerformanceMetrics> {
                const measures = await executableApp.getMetrics();
                for (const worker of featurePage.workers()) {
                    const workerEntries = await worker.evaluate(() => {
                        return {
                            marks: JSON.stringify(globalThis.performance.getEntriesByType('mark')),
                            measures: JSON.stringify(globalThis.performance.getEntriesByType('measure')),
                        };
                    });

                    measures.marks.push(...(JSON.parse(workerEntries.marks) as PerformanceEntry[]));
                    measures.measures.push(...(JSON.parse(workerEntries.measures) as PerformanceEntry[]));
                }

                for (const frame of featurePage.frames()) {
                    const frameEntries = await frame.evaluate(() => {
                        return {
                            marks: JSON.stringify(globalThis.performance.getEntriesByType('mark')),
                            measures: JSON.stringify(globalThis.performance.getEntriesByType('measure')),
                        };
                    });

                    measures.marks.push(...(JSON.parse(frameEntries.marks) as PerformanceEntry[]));
                    measures.measures.push(...(JSON.parse(frameEntries.measures) as PerformanceEntry[]));
                }
                return measures;
            }

            return { page: featurePage, response, getMetrics };
        },
    };
}

function toSearchQuery({ featureName, configName, queryParams }: IWithFeatureOptions): string {
    const queryStr = `?feature=${encodeURIComponent(featureName || '')}&config=${encodeURIComponent(configName || '')}`;
    if (queryParams) {
        return Object.entries(queryParams).reduce((currQuery, [key, value]) => {
            return `${currQuery}&${key}=${encodeURIComponent(value)}`;
        }, queryStr);
    }
    return queryStr;
}

function isNonReactDevMessage(type: string, [firstArg]: unknown[]) {
    return type !== 'info' || typeof firstArg !== 'string' || !firstArg.startsWith('%cDownload the React DevTools');
}
