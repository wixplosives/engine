import {
    IFeatureMessage,
    IFeatureTarget,
    IPortMessage,
    isProcessMessage,
    ProcessMessageId
} from '@wixc3/engine-scripts';
import { ChildProcess, fork } from 'child_process';
import isCI from 'is-ci';
import puppeteer from 'puppeteer';
import { createDisposables } from './disposables';

const [execDriverLetter] = process.argv0;
const cliEntry = require.resolve('@wixc3/engine-scripts/cli');

export interface IWithFeatureOptions extends IFeatureTarget, puppeteer.LaunchOptions {}

export interface IGetLoadedFeatureOptions extends IFeatureTarget {
    allowErrors?: boolean;
}

let browser: puppeteer.Browser | null = null;

after('close puppeteer browser, if open', async () => {
    if (browser) {
        await browser.close();
        browser = null;
    }
});

export function withFeature(basePath: string, withFeatureOptions: IWithFeatureOptions = {}) {
    if (process.platform === 'win32') {
        basePath = correctWin32DriveLetter(basePath);
    }
    const disposeAfterAll = createDisposables();
    const disposeAfterEach = createDisposables();
    const { headless, devtools, slowMo, configName, featureName, projectPath, queryParams } = withFeatureOptions;

    if (isCI && (headless === false || devtools === true || slowMo !== undefined)) {
        throw new Error(
            `withFeature was called with development time options in CI:\n${JSON.stringify(withFeatureOptions)}`
        );
    }

    let featureUrl: string;
    let engineStartProcess: ChildProcess;
    let allowErrors = false;
    const capturedErrors: Error[] = [];

    before('start application', async function() {
        this.timeout(60_000 * 4); // 4 minutes
        engineStartProcess = fork(cliEntry, ['start-engine-server'], {
            stdio: 'inherit',
            cwd: basePath,
            execArgv: [
                // '--inspect-brk',
                // '--trace-warnings'
            ]
        });

        const { port } = (await waitForProcessMessage(engineStartProcess, 'port')) as IPortMessage;

        disposeAfterAll.add(async () => {
            engineStartProcess.send({ id: 'server-disconnect' });
            await waitForProcessMessage(engineStartProcess, 'server-disconnected');
            await new Promise((resolve, reject) => {
                engineStartProcess.kill();
                engineStartProcess.once('exit', () => {
                    engineStartProcess.off('error', reject);
                    resolve();
                });
                engineStartProcess.once('error', reject);
            });
        });

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
                allowErrors = false;
                throw new Error(`there were uncaught page errors during the test:\n${errorsText}`);
            }
        }
        allowErrors = false;
    });

    after(async function() {
        this.timeout(60_000);
        disposeAfterAll.dispose();
    });

    return {
        async getLoadedFeature(
            {
                featureName: targetFeatureName = featureName,
                configName: targetConfigName = configName,
                projectPath: currentProjectPath = projectPath,
                allowErrors: targetAllowErrors = false
            }: IGetLoadedFeatureOptions = {},
            options?: puppeteer.DirectNavigationOptions
        ) {
            if (!browser) {
                throw new Error('Browser is not open!');
            }
            if (!engineStartProcess) {
                throw new Error('Engine HTTP server is closed!');
            }
            allowErrors = targetAllowErrors;
            engineStartProcess.send({
                id: 'run-feature',
                payload: { configName, featureName, projectPath: currentProjectPath }
            });

            const { id } = (await waitForProcessMessage(engineStartProcess, 'feature-initialized')) as IFeatureMessage;

            disposeAfterEach.add(async () => {
                engineStartProcess.send({ id: 'close-feature', payload: { id } });
                await waitForProcessMessage(engineStartProcess, 'feature-closed');
            });

            const search = toSearchQuery({
                featureName: targetFeatureName,
                configName: targetConfigName,
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

async function waitForProcessMessage(childProcess: ChildProcess, messageId: ProcessMessageId): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
        function onMessage(message: unknown) {
            if (isProcessMessage(message) && message.id === messageId) {
                childProcess.off('message', onMessage);
                childProcess.off('error', reject);
                childProcess.off('exit', reject);
                resolve(message.payload);
            }
        }
        childProcess.on('message', onMessage);
        childProcess.once('error', reject);
        childProcess.once('exit', reject);
    });
}

function toSearchQuery({ featureName, configName, queryParams }: IFeatureTarget): string {
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
