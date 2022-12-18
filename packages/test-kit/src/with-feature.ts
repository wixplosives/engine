import isCI from 'is-ci';
import fs from '@file-services/node';
import playwright from 'playwright-core';
import { createDisposables } from '@wixc3/create-disposables';
import { RemoteHttpApplication } from './remote-http-application';
import { ForkedProcessApplication } from './forked-process-application';
import { ensureTracePath } from './utils';
import type { IExecutableApplication } from './types';
import { hookPageConsole } from './hook-page-console';
import type { TopLevelConfig } from '@wixc3/engine-core';
import type { PerformanceMetrics } from '@wixc3/engine-runtime-node';

const cliEntry = require.resolve('@wixc3/engineer/bin/engineer');

export interface IFeatureExecutionOptions {
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
     * Creates a playwright trace file for the test
     */
    tracing?: boolean | Tracing;

    /**
     * Creates a playwright trace file for the test
     */
    navigationOptions?: Parameters<playwright.Page['goto']>[1];

    /**
     * Error messages that are allowed to stay unhandled without failing the tests.
     * strings are tested for exact match.
     */
    allowedErrors?: Array<string | RegExp>;

    /**
     * console.error allowed errors (defaults to false)
     */
    consoleLogAllowedErrors?: boolean;
}

export interface IWithFeatureOptions extends Omit<IFeatureExecutionOptions, 'tracing'>, playwright.LaunchOptions {
    /**
     * If we want to test the engine against a running application, provide the port of the application.
     * It can be extracted from the log printed after 'engineer start' or 'engine run'
     */
    runningApplicationPort?: number;
    /** Specify directory where features will be looked up within the package */
    featureDiscoveryRoot?: string;

    /**
     * add tracing for the entire suite, the name of the test will be used as the zip name
     */
    tracing?: boolean | Omit<Tracing, 'name'>;
}

export interface Tracing {
    /**
     * path to a directory where the trace file will be saved
     * @defaultValue process.cwd()
     */
    outPath?: string;
    /**
     * should trace include screenshots
     * @defaultValue true
     */
    screenshots?: boolean;
    /**
     * should trace include snapshots
     * @defaultValue true
     */
    snapshots?: boolean;
    /**
     * name of the trace file
     * @defaultValue random string
     */
    name?: string;
}

let browser: playwright.Browser | undefined = undefined;
let featureUrl = '';
let executableApp: IExecutableApplication;

if (typeof after !== 'undefined') {
    after('close browser, if open', async function () {
        this.timeout(20_000);
        if (browser && browser.isConnected()) {
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
    const envDebugMode = 'DEBUG' in process.env || undefined;
    const debugMode = !!process.env.DEBUG;
    const {
        browserContextOptions: suiteBrowserContextOptions,
        featureName: suiteFeatureName,
        configName: suiteConfigName,
        runOptions: suiteOptions = {},
        queryParams: suiteQueryParams,
        runningApplicationPort,
        config: suiteConfig,
        featureDiscoveryRoot,
        tracing: suiteTracing = process.env.TRACING ? true : undefined,
        allowedErrors: suiteAllowedErrors = [],
        consoleLogAllowedErrors = false,
        navigationOptions: suiteNavigationOptions,
        headless = envDebugMode && !debugMode,
        devtools = envDebugMode && debugMode,
        slowMo,
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
        ? new RemoteHttpApplication(resolvedPort)
        : new ForkedProcessApplication(cliEntry, process.cwd(), featureDiscoveryRoot);

    before('launch browser', async function () {
        if (!browser) {
            this.timeout(60_000); // 1 minute
            browser = await playwright.chromium.launch({
                ...withFeatureOptions,
                args: ['--enable-precise-memory-info', ...(withFeatureOptions.args ?? [])],
            });
        }
    });

    before('engineer start', async function () {
        if (!featureUrl) {
            this.timeout(60_000 * 4); // 4 minutes
            const port = await executableApp.getServerPort();
            featureUrl = `http://localhost:${port}/main.html`;
        }
    });

    const tracingDisposables = new Set<(testName?: string) => Promise<void>>();

    afterEach('stop tracing', async function () {
        for (const tracingDisposable of tracingDisposables) {
            await tracingDisposable(this.test?.title);
        }
        tracingDisposables.clear();
    });

    afterEach('post-test cleanup', disposeAfterEach.dispose);

    afterEach('verify no page errors', () => {
        if (capturedErrors.length) {
            const errorsText = capturedErrors.join('\n');
            capturedErrors.length = 0;
            throw new Error(`there were uncaught page errors during the test:\n${errorsText}`);
        }
    });

    return {
        async getLoadedFeature({
            featureName = suiteFeatureName,
            configName = suiteConfigName,
            runOptions = suiteOptions,
            queryParams = suiteQueryParams,
            config = suiteConfig,
            browserContextOptions = suiteBrowserContextOptions,
            tracing = suiteTracing,
            allowedErrors = suiteAllowedErrors,
            navigationOptions = suiteNavigationOptions,
        }: IFeatureExecutionOptions = {}) {
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
            disposeAfterEach.add(() => browserContext.close());

            browserContext.on('page', onPageCreation);
            disposeAfterEach.add(() => browserContext.off('page', onPageCreation));

            const sanitizedSuiteTracing = typeof suiteTracing === 'boolean' ? {} : suiteTracing;
            const sanitizedTracing = typeof tracing === 'boolean' ? {} : tracing;

            if (sanitizedTracing) {
                const { screenshots, snapshots, name, outPath } = {
                    ...sanitizedTracing,
                    ...sanitizedSuiteTracing,
                    screenshots: true,
                    snapshots: true,
                    outPath: process.cwd(),
                };
                await browserContext.tracing.start({ screenshots, snapshots });
                tracingDisposables.add((testName) => {
                    return browserContext.tracing.stop({
                        path: ensureTracePath({
                            outPath,
                            fs,
                            name:
                                process.env.TRACING && process.env.TRACING !== 'true'
                                    ? process.env.TRACING
                                    : name ?? testName?.replace(/(\W+)/gi, '-').slice(1),
                        }),
                    });
                });
            }

            function onPageError(e: Error) {
                if (
                    !allowedErrors.some((allowed) =>
                        allowed instanceof RegExp ? allowed.test(e.message) : e.message === allowed
                    )
                ) {
                    capturedErrors.push(e);
                    console.error(e);
                } else {
                    if (consoleLogAllowedErrors) {
                        console.error(e);
                    }
                }
            }

            function onPageCreation(page: playwright.Page) {
                page.setDefaultNavigationTimeout(30_000);
                page.setDefaultTimeout(10_000);
                const disposeConsoleHook = hookPageConsole(page, isNonReactDevMessage);
                disposeAfterEach.add(disposeConsoleHook);
                page.on('pageerror', onPageError);
                disposeAfterEach.add(() => page.off('pageerror', onPageError));
            }

            const featurePage = await browserContext.newPage();

            const response = await featurePage.goto(featureUrl + search, navigationOptions);

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
