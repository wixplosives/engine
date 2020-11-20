import puppeteer from 'puppeteer';

export function createBrowserProvider(options?: puppeteer.LaunchOptions) {
    let browser: puppeteer.Browser | undefined;
    return {
        async loadPage(url: string) {
            if (!browser) {
                browser = await puppeteer.launch(options);
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
