/**
 * Service needed to complete window initialization
 */
export class WindowInitializerService {
    static apiId = 'WindowInitializerService';

    oncePageHide(handler: () => void) {
        window.addEventListener('pagehide', () => handler(), { once: true });
    }

    public getHref() {
        return window.location.href;
    }
}
