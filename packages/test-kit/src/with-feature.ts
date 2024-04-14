import { nodeFs as fs } from '@file-services/node';
import type { TopLevelConfig } from '@wixc3/engine-core';
import { type DisposableItem, type DisposableOptions, Disposables } from '@wixc3/patterns';
import { adjustCurrentTestTimeout, mochaCtx } from '@wixc3/testing';
import { DISPOSE_OF_TEMP_DIRS } from '@wixc3/testing-node';
import { getRunningFeature, uniqueHash } from '@wixc3/engine-scripts';
import isCI from 'is-ci';
import playwright from 'playwright-core';
import { reporters } from 'mocha';
import { ForkedProcessApplication } from './forked-process-application.js';
import { hookPageConsole } from './hook-page-console.js';
import { normalizeTestName } from './normalize-test-name.js';
import { RemoteHttpApplication } from './remote-http-application.js';
import { validateBrowser } from './supported-browsers.js';
import { ensureTracePath } from './utils/';
import { type ChildProcess, spawn, spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { createTempDirectorySync } from 'create-temp-directory';
import { linkNodeModules } from './link-test-dir.js';
import { retry, timeout } from 'promise-assist';
import { IExecutableApplication, ManagedRunEngine, RunningFeature } from '@wixc3/engine-cli';
import { once } from 'node:events';

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
     * @defaultValue 20_000
     */
    featureDisposeTimeout?: number;
    /**
     * tracing disposal timeout
     * @defaultValue 20_000
     */
    saveTraceTimeout?: number;
    /**
     * path to a directory where the fixture will be copied from
     */
    fixturePath?: string;
    /**
     * link node_modules for the fixture to the project
     */
    dependencies?: { type: 'link'; path: string } | { type: 'yarn' } | { type: 'npm' };
    /**
     * hook to manage initial fixture creation each hook is inherited from the suite level individually
     */
    hooks?: { afterFixtureCopy?: () => Promise<void> | void; afterInstall?: () => Promise<void> | void };
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
    buildFlow?: 'prebuilt' | 'lazy' | 'legacy';
    /**
     * If true, the run will be allowed to use stale build artifacts
     */
    allowStale?: boolean;
    /**
     * resets the browser context before each test
     */
    resetContextBetweenTests?: boolean;
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
     * @deprecated use `disposables` instead
     */
    disposeAfter: (disposable: DisposableItem, options?: Omit<DisposableOptions, 'dispose'>) => void;
    /**
     * Add a disposable to be disposed after the test.
     * by default this will add the disposable to the `FINALE` group
     * if running in persist mode, the disposable will be disposed after the suite
     */
    disposables: Disposables;
    /**
     * spawn a node environment
     */
    spawnProcessingEnv: typeof getRunningFeature;
    /**
     * spawn a child process
     */
    spawnSync: (command: string, args?: string[], spawnOptions?: SpawnSyncOptions) => ReturnType<typeof spawnSync>;
    /**
     * ensure a the path to the test temp directory exists and return it.
     */
    ensureProjectPath: () => string;
};

export const TRACING_DISPOSABLES = 'TRACING_DISPOSABLES';
export const PAGE_DISPOSABLES = 'PAGE_DISPOSABLES';
export const WITH_FEATURE_DISPOSABLES = 'WITH_FEATURE_DISPOSABLES';
export const ENGINE_DISPOSABLES = 'ENGINE_DISPOSABLES';
export const FINALE = 'FINALE';

let browser: playwright.Browser | undefined = undefined;
let featureUrl = '';
let executableApp: IExecutableApplication;

if (typeof after !== 'undefined') {
    after('close browser, if open', async function () {
        this.timeout(50_000);
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
    if (mochaCtx()?.currentTest) {
        throw new Error('withFeature cannot be called inside a test');
    }
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
        allowStale = !!process.env.DONT_BUILD,
        buildFlow = (process.env.WITH_FEATURE_BUILD_FLOW || 'prebuilt') as 'prebuilt' | 'lazy' | 'legacy',
        fixturePath: suiteFixturePath,
        dependencies: suiteDependencies,
        hooks: suiteHooks = {},
        resetContextBetweenTests = true,
    } = withFeatureOptions;

    if (
        isCI &&
        (headless === false || devtools === true || slowMo !== undefined || runningApplicationPort !== undefined)
    ) {
        throw new Error(
            `withFeature was called with development time options in CI:\n${JSON.stringify(withFeatureOptions)}`,
        );
    }

    const disposables = new Disposables('withFeature');
    disposables.registerGroup(TRACING_DISPOSABLES, { after: 'default' });
    disposables.registerGroup(PAGE_DISPOSABLES, { after: TRACING_DISPOSABLES });
    disposables.registerGroup(WITH_FEATURE_DISPOSABLES, { after: PAGE_DISPOSABLES });
    disposables.registerGroup(ENGINE_DISPOSABLES, { after: WITH_FEATURE_DISPOSABLES });
    disposables.registerGroup(DISPOSE_OF_TEMP_DIRS, { after: ENGINE_DISPOSABLES });
    disposables.registerGroup(FINALE, { after: DISPOSE_OF_TEMP_DIRS });
    const onDispose = (disposable: DisposableItem, options?: Omit<DisposableOptions, 'dispose'>) =>
        disposables.add({ name: 'onDispose', group: FINALE, dispose: disposable, ...options });

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

    if (buildFlow !== 'legacy') {
        executableApp = executableApp || new ManagedRunEngine({ skipBuild: buildFlow === 'prebuilt', allowStale });
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

    after('close browser context, if open', async function () {
        this.timeout(20_000);
        if (dedicatedBrowser) {
            await dedicatedBrowserContext?.close();
            await dedicatedBrowser.close();
            dedicatedBrowser = undefined;
            dedicatedBrowserContext = undefined;
        }
    });

    let alreadyInitialized = false;
    let fixtureSetup = false;
    let projectPath = '';
    let tmpDir: ReturnType<typeof createTempDirectorySync>;

    async function cleanup(this: Mocha.Context) {
        const verbose = process.env.VERBOSE_DISPOSE === 'true';
        // capture errors before disposing environment
        const capturedErrorsSnapshot = [...capturedErrors];
        fixtureSetup = false;
        const list = disposables.list();
        this.timeout(list.totalTimeout);
        if (verbose) {
            console.log(`Disposing`);
            console.log(JSON.stringify(list, null, 2));
        }
        await disposables.dispose();
        if (verbose) {
            console.log(`Disposed`);
            console.log('Disposing temp dirs');
        }
        await retry(() => tmpDir?.remove(), { retries: 5, delay: 200 });
        if (verbose) {
            console.log('Disposed temp dirs');
        }
        if (capturedErrorsSnapshot.length) {
            // clear captured errors for next test after disposing
            capturedErrors.length = 0;
            const errorsText = capturedErrorsSnapshot.join('\n');
            throw new Error(`there were uncaught page errors during the test:\n${errorsText}`);
        }
    }

    if (persist) {
        after('withFeature: cleanup suite level page', cleanup);
    } else {
        afterEach('withFeature: cleanup', cleanup);
    }

    function ensureProjectPath() {
        if (!tmpDir) {
            tmpDir = createTempDirectorySync('with-fixture');
            projectPath = tmpDir.path;
        }
        if (!fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath);
        }
        return projectPath;
    }

    return {
        ensureProjectPath,
        spawnSync: (command, args = [], spawnOptions = {}) => {
            if (!spawnOptions.cwd && !projectPath) {
                throw new Error('spawnSync cannot be called without providing a fixturePath or cwd');
            }
            return spawnSyncSafe(command, args, {
                stdio: 'inherit',
                cwd: projectPath,
                shell: true,
                ...spawnOptions,
            });
        },
        async spawnProcessingEnv(options) {
            const running = await getRunningFeature(options);
            disposables.add({
                name: `spawnProcessingEnv(${JSON.stringify(options)})`,
                group: ENGINE_DISPOSABLES,
                dispose: () => running.engine.shutdown(),
            });
            return running;
        },
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
            fixturePath = suiteFixturePath,
            dependencies = suiteDependencies,
            hooks = {},
        }: IFeatureExecutionOptions = {}) {
            hooks = { ...suiteHooks, ...hooks };
            if (fixtureSetup) {
                throw new Error('getLoadedFeature cannot be called more than once while fixturePath is provided!');
            }
            if (fixturePath) {
                fixtureSetup = true;
                ensureProjectPath();
                fs.copyDirectorySync(fixturePath, projectPath);
                await hooks.afterFixtureCopy?.();
                if (dependencies) {
                    if (dependencies.type === 'link') {
                        linkNodeModules(projectPath, dependencies.path);
                    } else if (dependencies.type === 'yarn' || dependencies.type === 'npm') {
                        const installOptions = {
                            cwd: projectPath,
                            shell: true,
                            stdio: debugMode ? 'inherit' : 'ignore',
                        } satisfies SpawnSyncOptions;
                        const shouldRetryInstall = !!process.env.NEW_FIXTURE_DEPENDENCIES_INSTALLATION;

                        if (shouldRetryInstall) {
                            const installTimeout = 10_000;

                            await retry(
                                () => {
                                    adjustCurrentTestTimeout(installTimeout);
                                    return timeout(
                                        spawnSafe(dependencies.type, ['install'], installOptions),
                                        installTimeout,
                                        `Dependencies installation ("${dependencies.type} install") timed out after ${installTimeout}ms`,
                                    );
                                },
                                {
                                    retries: 2,
                                    delay: 1_000,
                                },
                            );
                        } else {
                            spawnSyncSafe(dependencies.type, ['install'], installOptions);
                        }
                    }
                    await hooks.afterInstall?.();
                }
                runOptions = { ...runOptions, projectPath };
            }

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
                    if (resetContextBetweenTests) {
                        disposables.add({
                            group: PAGE_DISPOSABLES,
                            name: 'close browser context',
                            timeout: 5000,
                            dispose: async () => {
                                await dedicatedBrowserContext?.close();
                                dedicatedBrowserContext = undefined;
                            },
                        });
                    }
                }
            } else {
                if (!browser) {
                    throw new Error('Browser is not open!');
                }
                dedicatedBrowserContext = await browser.newContext(browserContextOptions);

                disposables.add({
                    group: WITH_FEATURE_DISPOSABLES,
                    name: `close browser context for feature "${featureName}"`,
                    timeout: 5000,
                    dispose: () => dedicatedBrowserContext?.close(),
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

            disposables.add({
                group: WITH_FEATURE_DISPOSABLES,
                name: `close feature "${featureName}"`,
                timeout: withFeatureOptions.featureDisposeTimeout ?? 20_000,
                dispose: runningFeature,
            });

            const search = toSearchQuery({
                featureName,
                configName: newConfigName,
                queryParams,
            });

            const featurePage = await dedicatedBrowserContext.newPage();

            disposables.add({
                group: PAGE_DISPOSABLES,
                name: 'close feature page' + (takeScreenshotsOfFailed ? ' and take screenshot' : ''),
                timeout: 10_000,
                dispose: async () => {
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
                            const sanitizedFilePath = filePath.replace(/[<>:"|?*]/g, '-');

                            await featurePage.screenshot({ path: sanitizedFilePath });

                            console.log(reporters.Base.color('bright yellow', screenShotMessage(sanitizedFilePath)));
                        }
                    }
                    await featurePage.close();
                },
            });

            const fullFeatureUrl = (buildFlow !== 'legacy' ? runningFeature.url : featureUrl) + search;
            const response = await featurePage.goto(fullFeatureUrl, navigationOptions);

            return {
                page: featurePage,
                response,
                getMetrics: () => getMetrics(runningFeature, featurePage),
            };
        },
        disposeAfter: onDispose,
        disposables,
    };
}

export function screenShotMessage(sanitizedFilePath: string): string {
    return `The screenshot has been saved at ${sanitizedFilePath}`;
}

async function getMetrics(runningFeature: RunningFeature, featurePage: playwright.Page) {
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
    disposables.add({
        name: 'stop listening for page creation',
        group: PAGE_DISPOSABLES,
        timeout: 1000,
        dispose: () => browserContext.off('page', onPageCreation),
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
        disposables.add({
            name: 'stop listening for console messages',
            group: PAGE_DISPOSABLES,
            dispose: disposeConsoleHook,
        });
        page.on('pageerror', onPageError);
        disposables.add({
            name: 'stop listening for page errors',
            group: PAGE_DISPOSABLES,
            timeout: 1000,
            dispose: () => page.off('pageerror', onPageError),
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
    disposables.add({
        group: TRACING_DISPOSABLES,
        name: 'stop tracing',
        timeout: withFeatureOptions?.saveTraceTimeout ?? 20_000,
        dispose: () => {
            const testName = mochaCtx()?.currentTest?.title;
            return browserContext.tracing.stop({
                path: ensureTracePath({
                    outPath,
                    fs,
                    name:
                        (process.env.TRACING && process.env.TRACING !== 'true'
                            ? process.env.TRACING
                            : name ?? (testName ? normalizeTestName(testName) : 'nameless-test')) +
                        (process.env.TRACING_POSTFIX ?? ''),
                }),
            });
        },
    });
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

const throwNonZeroExitCodeError = (
    args: Parameters<typeof spawnSync | typeof spawn>,
    status: ChildProcess['exitCode'],
) => {
    const command = args.filter((arg) => typeof arg === 'string').join(' ');
    const exitCode = status ?? 'null';

    throw new Error(`Command "${command}" failed with exit code ${exitCode}.`);
};

export const spawnSyncSafe = (...args: Parameters<typeof spawnSync>) => {
    const spawnResult = spawnSync(...args);
    if (spawnResult.status !== 0) {
        throwNonZeroExitCodeError(args, spawnResult.status);
    }
    return spawnResult;
};

const spawnSafe = async (...args: Parameters<typeof spawn>) => {
    const childProcess = spawn(...args);
    const [status] = (await once(childProcess, 'exit')) as [ChildProcess['exitCode']];
    if (status !== 0) {
        throwNonZeroExitCodeError(args, status);
    }
};
