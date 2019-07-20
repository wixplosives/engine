import { Browser, launch, LaunchOptions } from 'puppeteer';

export function createBrowserProvider(options?: LaunchOptions) {
    let browser: Browser | null;
    return {
        async loadPage(url: string) {
            if (!browser) {
                browser = await launch(options);
            }
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle0' });
            return page;
        },
        async disposePages() {
            if (browser) {
                const pages = await browser.pages();
                for (const page of pages) {
                    await page.close({ runBeforeUnload: false });
                }
            }
        },
        async dispose() {
            if (browser) {
                await browser.close();
                browser = null;
            }
        }
    };
}
