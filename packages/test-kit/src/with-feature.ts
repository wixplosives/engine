import isCI from 'is-ci';
import puppeteer from 'puppeteer';
import { DetachedApp } from './detached-app';
import { createDisposables } from './disposables';

const [execDriverLetter] = process.argv0;
const cliEntry = require.resolve('@wixc3/engine-scripts/cli');

export interface IFeatureTestOptions extends puppeteer.LaunchOptions {
    basePath?: string;
    featureName?: string;
    configName?: string;
    projectPath?: string;
    queryParams?: Record<string, string>;
    allowErrors?: boolean;
}

let browser: puppeteer.Browser | null = null;

after('close puppeteer browser, if open', async () => {
    if (browser) {
        await browser.close();
        browser = null;
    }
});

export function withFeature(withFeatureOptions: IFeatureTestOptions = {}) {
    let { basePath = process.cwd() } = withFeatureOptions;
    if (process.platform === 'win32') {
        basePath = correctWin32DriveLetter(basePath);
    }

    const disposeAfterAll = createDisposables();
    const disposeAfterEach = createDisposables();
    const {
        headless,
        devtools,
        slowMo,
        featureName: suiteFeatureName,
        configName: suiteConfigName,
        projectPath: suiteProjectPath = basePath,
        allowErrors: suiteAllowErrors = false,
        queryParams
    } = withFeatureOptions;

    if (isCI && (headless === false || devtools === true || slowMo !== undefined)) {
        throw new Error(
            `withFeature was called with development time options in CI:\n${JSON.stringify(withFeatureOptions)}`
        );
    }

    let featureUrl: string;
    let allowErrors = suiteAllowErrors;
    const capturedErrors: Error[] = [];
    const executableApp = new DetachedApp(cliEntry, basePath);

    before('start application', async function() {
        this.timeout(60_000 * 4); // 4 minutes

        const port = await executableApp.startServer();

        disposeAfterAll.add(async () => executableApp.closeServer());

        featureUrl = `http://localhost:${port}/main.html`;
    });

    before('launch puppeteer', async function() {
        if (!browser) {
            this.timeout(60_000); // 1 minute
            browser = await puppeteer.launch(withFeatureOptions);
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

    after(async function() {
        this.timeout(60_000);
        await disposeAfterAll.dispose();
    });

    return {
        async getLoadedFeature(
            {
                featureName = suiteFeatureName,
                configName = suiteConfigName,
                projectPath = suiteProjectPath,
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
                projectPath
            });

            disposeAfterEach.add(async () => executableApp.closeFeature());

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
            const response = await page.goto(featureUrl + search, options);

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
