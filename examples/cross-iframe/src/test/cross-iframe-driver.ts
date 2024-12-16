import type { Page } from 'playwright-core';

export class CrossIframeDriver {
    public static async getFromRoot(root: Page) {
        await root.waitForSelector('body');
        return new CrossIframeDriver(root);
    }

    constructor(private page: Page) {}

    public clickNavigationButton(index: number) {
        return this.page.locator(`button.init-iframe-button-${index}`).click();
    }

    public clickNavigationButtonByTestId(testId: string) {
        return this.page.locator(`button#${testId}`).click();
    }

    public getIframeContent() {
        const iframe = this.page.frameLocator('iframe');
        const iframeBody = iframe.locator('body');

        return iframeBody.innerText();
    }
}
