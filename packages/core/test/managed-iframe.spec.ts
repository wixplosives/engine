import { createDisposables } from '../src';

import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import { spy } from 'sinon';
import { ManagedIframe } from '../src/com/managed-iframe';

describe('Managed Iframe', () => {
    const disposables = createDisposables();
    afterEach(disposables.dispose);

    const createIframe = (): HTMLIFrameElement => {
        const iframe = document.createElement('iframe');
        disposables.add(() => iframe.remove());
        document.body.appendChild(iframe);
        return iframe;
    };

    it('supports updating hash params when communicating with iframe', async () => {
        const host = createIframe();

        const managedIframe = new ManagedIframe(host.contentWindow);
        expect(await managedIframe.getHashParams()).to.eq(undefined);
        const hashParams = {
            test: 'test',
        };

        managedIframe.updateHashParams(hashParams);

        await waitFor(async () => {
            const deserializedHash = await managedIframe.getHashParams();
            expect(deserializedHash).to.deep.equal(hashParams);
        });
    });

    it('triggers hashupdate event when changing hash params', async () => {
        const onHashChange = spy();
        const host = createIframe();
        const managedIframe = new ManagedIframe(host.contentWindow);

        managedIframe.onHashChange(onHashChange);

        managedIframe.updateHashParams({
            test: 'test',
        });

        await waitFor(() => {
            expect(onHashChange.callCount).to.eq(1);
        });
    });
});
