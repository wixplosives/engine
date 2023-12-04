import { nodeFs as fs } from '@file-services/node';
import type { TopLevelConfig } from '@wixc3/engine-core';
import { Disposables, type DisposableItem, type DisposableOptions } from '@wixc3/patterns';
import { mochaCtx } from '@wixc3/testing';
import { DISPOSE_OF_TEMP_DIRS } from '@wixc3/testing-node';
import { uniqueHash } from '@wixc3/engine-scripts';
import isCI from 'is-ci';
import playwright from 'playwright-core';
import { reporters } from 'mocha';
import { ForkedProcessApplication } from './forked-process-application.js';
import { hookPageConsole } from './hook-page-console.js';
import { normalizeTestName } from './normalize-test-name.js';
import { RemoteHttpApplication } from './remote-http-application.js';
import { validateBrowser } from './supported-browsers.js';
import type { IExecutableApplication, RunningTestFeature } from './types.js';
import { ensureTracePath } from './utils/index.js';
import { ManagedRunEngine } from './engine-app-manager.js';

const cliEntry = require.resolve('@wixc3/engineer/dist/cli');

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
    /**
     * @defaultValue 10_000
     */
    featureDisposeTimeout?: number;
    /**
     * tracing disposal timeout
     * @defaultValue 10_000
     */
    saveTraceTimeout?: number;
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
    /**
     * Take screenshots of failed tests, file name is the test title + hash, the file path is the output folder + the test's titlePath
     */
    takeScreenshotsOfFailed?: boolean | Pick<Tracing, 'outPath'>;
    /**
     * Keeps the page open and the feature running for the all the tests in the suite
     */
    persist?: boolean;
    /**
     * Prebuild the engine before running the tests
     */
    buildFlow?: 'prebuild' | 'lazy';
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

export type WithFeatureApi = {
    /**
     * Opens a browser page with the feature loaded
     * @param options - options to override the suite options
     * @returns a promise that resolves to the page and the response
     */
    getLoadedFeature: (options?: IFeatureExecutionOptions) => Promise<{
        page: playwright.Page;
        response: playwright.Response | null;
        getMetrics: () => Promise<{
            marks: PerformanceEntry[];
            measures: PerformanceEntry[];
        }>;
    }>;
    /**
     * @deprecated use `onDispose` instead
     */
    disposeAfter: typeof Disposables.prototype.add;
    /**
     * Add a disposable to be disposed after the test.
     * by default this will add the disposable to the `FINALE` group
     * if running in persist mode, the disposable will be disposed after the suite
     */
    onDispose: typeof Disposables.prototype.add;
};

export const WITH_FEATURE_DISPOSABLES = 'WITH_FEATURE_DISPOSABLES';
export const PAGE_DISPOSABLES = 'PAGE_DISPOSABLES';
export const TRACING_DISPOSABLES = 'TRACING_DISPOSABLES';
export const FINALE = 'FINALE';

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

export function withFeature(withFeatureOptions: IWithFeatureOptions = {}): WithFeatureApi {
    const envDebugMode = 'DEBUG' in process.env;
    const debugMode = !!process.env.DEBUG;
    const port = parseInt(process.env.DEBUG!);
    const browserToRun = validateBrowser(process.env.BROWSER ?? 'chromium');

    const {
        browserContextOptions: suiteBrowserContextOptions,
        featureName: suiteFeatureName,
        configName: suiteConfigName,
        runOptions: suiteOptions = {},
        queryParams: suiteQueryParams,
        runningApplicationPort = port >= 3000 ? port : undefined,
        config: suiteConfig,
        featureDiscoveryRoot,
        tracing: suiteTracing = process.env.TRACING ? true : undefined,
        allowedErrors: suiteAllowedErrors = [],
        consoleLogAllowedErrors = false,
        navigationOptions: suiteNavigationOptions,
        headless = envDebugMode ? !debugMode : undefined,
        devtools = envDebugMode ? debugMode : undefined,
        slowMo,
        persist,
        takeScreenshotsOfFailed = true,
        buildFlow = process.env.WITH_FEATURE_BUILD_FLOW,
    } = withFeatureOptions;

    if (
        isCI &&
        (headless === false || devtools === true || slowMo !== undefined || runningApplicationPort !== undefined)
    ) {
        throw new Error(
            `withFeature was called with development time options in CI:\n${JSON.stringify(withFeatureOptions)}`,
        );
    }

    const capturedErrors: Error[] = [];
    if (!process.env.PLAYWRIGHT_SERVER) {
        before('launch browser', async function () {
            if (!browser) {
                this.timeout(60_000); // 1 minute
                browser = await playwright[browserToRun].launch({
                    ...withFeatureOptions,
                    headless,
                    devtools,
                    args: ['--enable-precise-memory-info', ...(withFeatureOptions.args ?? [])],
                });
            }
        });
    }

    if (buildFlow) {
        executableApp = executableApp || new ManagedRunEngine({ skipBuild: buildFlow === 'prebuild' });
        before('build test artifacts', function () {
            this.timeout(60_000 * 4);
            return executableApp.init?.();
        });
    } else {
        // THIS IS THE DEPRECATED FLOW //
        const resolvedPort =
            runningApplicationPort ??
            (process.env.ENGINE_APPLICATION_PORT ? parseInt(process.env.ENGINE_APPLICATION_PORT) : undefined);

        executableApp = resolvedPort
            ? new RemoteHttpApplication(resolvedPort)
            : new ForkedProcessApplication(cliEntry, process.cwd(), featureDiscoveryRoot);

        before('engineer start', async function () {
            if (!featureUrl) {
                this.timeout(60_000 * 4); // 4 minutes
                const port = await executableApp.getServerPort();
                featureUrl = `http://localhost:${port}/main.html`;
            }
        });
    }

    let dedicatedBrowser: playwright.Browser | undefined;
    let dedicatedBrowserContext: playwright.BrowserContext | undefined;

    afterEach('verify no page errors', () => {
        if (capturedErrors.length) {
            const errorsText = capturedErrors.join('\n');
            capturedErrors.length = 0;
            throw new Error(`there were uncaught page errors during the test:\n${errorsText}`);
        }
    });

    after('close browser context, if open', async function () {
        this.timeout(20_000);
        if (dedicatedBrowser) {
            await dedicatedBrowser.close();
            dedicatedBrowser = undefined;
        }
    });

    const disposables = new Disposables();
    disposables.registerGroup(TRACING_DISPOSABLES, { after: 'default' });
    disposables.registerGroup(PAGE_DISPOSABLES, { after: TRACING_DISPOSABLES });
    disposables.registerGroup(WITH_FEATURE_DISPOSABLES, { after: PAGE_DISPOSABLES });
    disposables.registerGroup(DISPOSE_OF_TEMP_DIRS, { after: WITH_FEATURE_DISPOSABLES });
    disposables.registerGroup(FINALE, { after: DISPOSE_OF_TEMP_DIRS });
    const onDispose = (disposable: DisposableItem, options?: DisposableOptions) =>
        disposables.add(disposable, { group: FINALE, ...options });

    let alreadyInitialized = false;

    if (persist) {
        after('dispose suite level page', async function () {
            this.timeout(disposables.list().totalTimeout);
            await disposables.dispose();
        });
    } else {
        afterEach('dispose all', async function () {
            this.timeout(disposables.list().totalTimeout);
            await disposables.dispose();
        });
    }

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
            if (process.env.PLAYWRIGHT_SERVER) {
                if (!dedicatedBrowser) {
                    dedicatedBrowser = await playwright[browserToRun].connect(process.env.PLAYWRIGHT_SERVER, {
                        slowMo,
                    });
                }

                if (!dedicatedBrowserContext) {
                    dedicatedBrowserContext = await dedicatedBrowser.newContext(browserContextOptions);
                    await enableTestBrowserContext({
                        disposables,
                        browserContext: dedicatedBrowserContext,
                        suiteTracing,
                        tracing,
                        withFeatureOptions,
                        allowedErrors,
                        capturedErrors,
                        consoleLogAllowedErrors,
                    });
                }
            } else {
                if (!browser) {
                    throw new Error('Browser is not open!');
                }
                dedicatedBrowserContext = await browser.newContext(browserContextOptions);

                disposables.add(() => dedicatedBrowserContext?.close(), {
                    group: WITH_FEATURE_DISPOSABLES,
                    name: `close browser context for feature "${featureName}"`,
                    timeout: 5000,
                });

                await enableTestBrowserContext({
                    browserContext: dedicatedBrowserContext,
                    disposables,
                    suiteTracing,
                    tracing,
                    withFeatureOptions,
                    allowedErrors,
                    capturedErrors,
                    consoleLogAllowedErrors,
                });
            }

            if (!executableApp) {
                throw new Error('Engine HTTP server is closed!');
            }

            if (persist && alreadyInitialized) {
                throw new Error('getLoadedFeature cannot be called more than once while persist mode is on!');
            }
            alreadyInitialized = true;
            const runningFeature = await executableApp.runFeature({
                featureName,
                configName,
                runtimeOptions: runOptions,
                overrideConfig: config,
            });

            if (runningFeature === undefined) {
                throw new Error(`Feature "${featureName}" was not found`);
            }

            const { configName: newConfigName } = runningFeature;

            disposables.add(() => runningFeature.dispose(), {
                group: WITH_FEATURE_DISPOSABLES,
                name: `close feature "${featureName}"`,
                timeout: withFeatureOptions.featureDisposeTimeout ?? 10_000,
            });

            const search = toSearchQuery({
                featureName,
                configName: newConfigName,
                queryParams,
            });

            const featurePage = await dedicatedBrowserContext.newPage();

            disposables.add(
                async () => {
                    if (takeScreenshotsOfFailed) {
                        const suiteTracingOptions = typeof suiteTracing === 'boolean' ? {} : suiteTracing;
                        const testTracingOptions = typeof tracing === 'boolean' ? {} : tracing;
                        const outPath =
                            (typeof takeScreenshotsOfFailed !== 'boolean' && takeScreenshotsOfFailed.outPath) ||
                            `${
                                suiteTracingOptions?.outPath ?? testTracingOptions?.outPath ?? process.cwd()
                            }/screenshots-of-failed-tests`;

                        const ctx = mochaCtx();

                        if (ctx?.currentTest?.state === 'failed') {
                            const testPath = ctx.currentTest.titlePath().join('/').replace(/\s/g, '-');
                            const filePath = `${outPath}/${testPath}__${uniqueHash()}.png`;
                            await featurePage.screenshot({ path: filePath });

                            console.log(
                                reporters.Base.color('bright yellow', `The screenshot has been saved at ${filePath}`),
                            );
                        }
                    }
                    await featurePage.close();
                },
                {
                    group: PAGE_DISPOSABLES,
                    name: 'close feature page' + (takeScreenshotsOfFailed ? ' and take screenshot' : ''),
                    timeout: 10_000,
                },
            );

            const fullFeatureUrl = (buildFlow ? runningFeature.url : featureUrl) + search;
            const response = await featurePage.goto(fullFeatureUrl, navigationOptions);

            return {
                page: featurePage,
                response,
                getMetrics: () => getMetrics(runningFeature, featurePage),
            };
        },
        disposeAfter: onDispose,
        onDispose,
    };
}

async function getMetrics(runningFeature: RunningTestFeature, featurePage: playwright.Page) {
    try {
        const measures = await runningFeature.getMetrics();
        for (const webWorker of featurePage.workers()) {
            const perfEntries = await webWorker.evaluate(() => {
                return {
                    marks: JSON.stringify(globalThis.performance.getEntriesByType('mark')),
                    measures: JSON.stringify(globalThis.performance.getEntriesByType('measure')),
                };
            });

            measures.marks.push(...(JSON.parse(perfEntries.marks) as PerformanceEntry[]));
            measures.measures.push(...(JSON.parse(perfEntries.measures) as PerformanceEntry[]));
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
    } catch (e) {
        console.error(
            `Failed to get metrics for ${runningFeature.featureName} ${runningFeature.configName} with error: ${e}`,
        );
        return { marks: [], measures: [] };
    }
}

async function enableTestBrowserContext({
    browserContext,
    disposables,
    suiteTracing,
    tracing,
    withFeatureOptions,
    allowedErrors,
    capturedErrors,
    consoleLogAllowedErrors,
}: {
    browserContext: playwright.BrowserContext;
    disposables: Disposables;
    suiteTracing: boolean | Omit<Tracing, 'name'> | undefined;
    tracing: boolean | Tracing | undefined;
    withFeatureOptions: IWithFeatureOptions;
    allowedErrors: (string | RegExp)[];
    capturedErrors: Error[];
    consoleLogAllowedErrors: boolean;
}) {
    browserContext.on('page', onPageCreation);
    disposables.add(() => browserContext.off('page', onPageCreation), {
        name: 'stop listening for page creation',
        group: PAGE_DISPOSABLES,
        timeout: 1000,
    });

    const suiteTracingOptions = typeof suiteTracing === 'boolean' ? {} : suiteTracing;
    const testTracingOptions = typeof tracing === 'boolean' ? {} : tracing;

    if (testTracingOptions) {
        await enableTracing({
            suiteTracingOptions,
            testTracingOptions,
            browserContext,
            disposables,
            withFeatureOptions,
        });
    }

    function onPageError(e: Error) {
        if (
            !allowedErrors.some((allowed) =>
                allowed instanceof RegExp ? allowed.test(e.message) : e.message === allowed,
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
        page.setDefaultNavigationTimeout(30000);
        page.setDefaultTimeout(10000);
        const disposeConsoleHook = hookPageConsole(page, isNonReactDevMessage);
        disposables.add(disposeConsoleHook, {
            name: 'stop listening for console messages',
            group: PAGE_DISPOSABLES,
        });
        page.on('pageerror', onPageError);
        disposables.add(() => page.off('pageerror', onPageError), {
            name: 'stop listening for page errors',
            group: PAGE_DISPOSABLES,
            timeout: 1000,
        });
    }
}

async function enableTracing({
    suiteTracingOptions,
    testTracingOptions,
    browserContext,
    disposables,
    withFeatureOptions,
}: {
    suiteTracingOptions: Omit<Tracing, 'name'> | undefined;
    testTracingOptions: Tracing;
    browserContext: playwright.BrowserContext;
    disposables: Disposables;
    withFeatureOptions: IWithFeatureOptions;
}) {
    const screenshots = suiteTracingOptions?.screenshots ?? testTracingOptions.screenshots ?? true;
    const snapshots = suiteTracingOptions?.snapshots ?? testTracingOptions.snapshots ?? true;
    const outPath = suiteTracingOptions?.outPath ?? testTracingOptions.outPath ?? process.cwd();
    const name = testTracingOptions.name;

    await browserContext.tracing.start({ screenshots, snapshots });
    disposables.add(
        () => {
            const testName = mochaCtx()?.currentTest?.title;
            return browserContext.tracing.stop({
                path: ensureTracePath({
                    outPath,
                    fs,
                    name:
                        process.env.TRACING && process.env.TRACING !== 'true'
                            ? process.env.TRACING
                            : name ?? (testName ? normalizeTestName(testName) : 'nameless-test'),
                }),
            });
        },
        {
            group: TRACING_DISPOSABLES,
            name: 'stop tracing',
            timeout: withFeatureOptions?.saveTraceTimeout ?? 10000,
        },
    );
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
