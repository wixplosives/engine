import playwright from 'playwright-core';

export function createBrowserProvider(options?: playwright.LaunchOptions) {
    let browser: playwright.Browser | undefined;
    return {
        async loadPage(url: string) {
            if (!browser) {
                browser = await playwright.chromium.launch(options);
            }
            const page = await browser.newPage();
            await page.goto(url);
            return page;
        },
        async dispose() {
            if (browser && browser.isConnected()) {
                await browser.close();
            }
            browser = undefined;
        },
    };
}
