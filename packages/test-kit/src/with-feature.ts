import isCI from 'is-ci';
import puppeteer from 'puppeteer';
import { AttachedApp } from './attached-app';
import { DetachedApp } from './detached-app';
import { createDisposables } from './disposables';
import { IExecutableApplication } from './types';

const [execDriverLetter] = process.argv0;
const cliEntry = require.resolve('@wixc3/engine-scripts/cli');

export interface IFeatureTestOptions extends puppeteer.LaunchOptions {
    /**
     * absolute path to the root directory of the feature package.
     * @default process.cwd
     */
    basePath?: string;

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
     * if value will be set to `true`, errors from the browser will not fail tests
     * @default false
     */
    allowErrors?: boolean;

    /**
     * runtime options that will be provided to the node environments
     */
    runOptions?: Record<string, string>;

    /**
     * If we want to test the engine against a running application, proveide the port of the application.
     * It can be extracted from the log printed after 'engine start' or 'engine run'
     */
    runningApplicationPort?: number;
}

let browser: puppeteer.Browser | null = null;
let featureUrl: string = '';
let executableApp: IExecutableApplication;

after('close puppeteer browser, if open', async () => {
    if (browser) {
        await browser.close();
        browser = null;
    }
});

after('close engine server, if open', async function() {
    this.timeout(60_000);
    if (featureUrl) {
        await executableApp.closeServer();
        featureUrl = '';
    }
});

export function withFeature(withFeatureOptions: IFeatureTestOptions = {}) {
    let { basePath = process.cwd() } = withFeatureOptions;
    if (process.platform === 'win32') {
        basePath = correctWin32DriveLetter(basePath);
    }

    const disposeAfterEach = createDisposables();
    const {
        headless,
        devtools,
        slowMo,
        featureName: suiteFeatureName,
        configName: suiteConfigName,
        runOptions: suiteOptions = {},
        allowErrors: suiteAllowErrors = false,
        queryParams: suiteQueryParams,
        runningApplicationPort
    } = withFeatureOptions;

    if (isCI && (headless === false || devtools === true || slowMo !== undefined)) {
        throw new Error(
            `withFeature was called with development time options in CI:\n${JSON.stringify(withFeatureOptions)}`
        );
    }

    let allowErrors = suiteAllowErrors;
    const capturedErrors: Error[] = [];

    executableApp = runningApplicationPort
        ? new AttachedApp(runningApplicationPort)
        : new DetachedApp(cliEntry, process.cwd());

    before('launch puppeteer', async function() {
        if (!browser) {
            this.timeout(60_000); // 1 minute
            browser = await puppeteer.launch(withFeatureOptions);
        }
    });

    before('engine start', async function() {
        if (!featureUrl) {
            this.timeout(60_000 * 4); // 4 minutes
            const port = await executableApp.getServerPort();
            featureUrl = `http://localhost:${port}/main.html`;
        }
    });

    afterEach(disposeAfterEach.dispose);

    const pages = new Set<puppeteer.Page>();
    afterEach('close pages', () => Promise.all(Array.from(pages).map(page => page.close())).then(() => pages.clear()));
    afterEach('verify no page errors', () => {
        if (capturedErrors.length) {
            const errorsText = capturedErrors.join('\n');
            capturedErrors.length = 0;
            if (!allowErrors) {
                allowErrors = suiteAllowErrors;
                throw new Error(`there were uncaught page errors during the test:\n${errorsText}`);
            }
        }
        allowErrors = suiteAllowErrors;
    });

    return {
        async getLoadedFeature(
            {
                featureName = suiteFeatureName,
                configName = suiteConfigName,
                runOptions = suiteOptions,
                queryParams = suiteQueryParams,
                allowErrors: targetAllowErrors = false
            }: IFeatureTestOptions = {},
            options?: puppeteer.DirectNavigationOptions
        ) {
            if (!browser) {
                throw new Error('Browser is not open!');
            }
            if (!executableApp) {
                throw new Error('Engine HTTP server is closed!');
            }

            allowErrors = targetAllowErrors;
            await executableApp.runFeature({
                featureName,
                configName,
                runtimeOptions: runOptions
            });

            disposeAfterEach.add(async () =>
                executableApp.closeFeature({
                    featureName,
                    configName
                })
            );

            const search = toSearchQuery({
                featureName,
                configName,
                queryParams
            });
            const page = await browser.newPage();
            pages.add(page);
            page.on('pageerror', e => {
                capturedErrors.push(e);
                // tslint:disable-next-line: no-console
                console.error(e);
            });
            const response = await page.goto(featureUrl + search, { waitUntil: 'networkidle0', ...options });

            return { page, response };
        }
    };
}

function toSearchQuery({ featureName, configName, queryParams }: IFeatureTestOptions): string {
    const queryStr = `?feature=${encodeURIComponent(featureName || '')}&config=${encodeURIComponent(configName || '')}`;
    if (queryParams) {
        return Object.entries(queryParams).reduce((currQuery, [key, value]) => {
            return `${currQuery}&${key}=${encodeURIComponent(value)}`;
        }, queryStr);
    }
    return queryStr;
}

/**
 * Ensures the drive letter has correct casing, as webpack fails to use
 * canonical path (to lower-case on Windows) causing duplicate modules (in certain
 * win32 node executions; e.g. vscode debugger).
 */
export function correctWin32DriveLetter(absolutePath: string): string {
    const [driveLetter, secondChar] = absolutePath;
    if (secondChar === ':' && driveLetter !== execDriverLetter && driveLetter === execDriverLetter.toLowerCase()) {
        absolutePath = absolutePath[0].toUpperCase() + absolutePath.slice(1);
    }
    return absolutePath;
}
