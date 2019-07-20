import { Communication, MultiEndPointAsyncEnvironment } from '../src';

export class ComBrowserTestKit {
    private iframes: HTMLIFrameElement[] = [];
    private activeCommunications: Communication[] = [];

    public dispose() {
        for (const frame of this.iframes) {
            frame.remove();
        }
        this.iframes.length = 0;
        for (const communication of this.activeCommunications) {
            communication.dispose();
        }
        this.activeCommunications.length = 0;
    }

    public createTestCom(id: string = 'TEST_COM') {
        const com = new Communication(window, id);
        this.activeCommunications.push(com);
        return com;
    }

    public async createTestIframe(com: Communication, envName: string) {
        const iframe = document.createElement('iframe');
        iframe.style.width = '300px';
        iframe.style.height = '300px';
        iframe.style.bottom = '0px';
        iframe.style.right = '0px';
        iframe.style.position = 'fixed';
        this.iframes.push(iframe);
        document.body.appendChild(iframe);
        return com.spawn(new MultiEndPointAsyncEnvironment(envName, 'iframe', { env: 'main' }), iframe);
    }
}
