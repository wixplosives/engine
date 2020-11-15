import { Browser, launch, LaunchOptions } from 'puppeteer';

export function createBrowserProvider(options?: LaunchOptions) {
    let browser: Browser | undefined;
    return {
        async loadPage(url: string) {
            if (!browser) {
                browser = await launch(options);
            }
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle0' });
            return page;
        },
        async dispose() {
            if (browser && browser.isConnected) {
                await browser.close();
            }
            browser = undefined;
        },
    };
}
