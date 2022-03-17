import { Communication } from '@wixc3/engine-com';
import { IPCHost } from '@wixc3/engine-core-node';

const ipcHost = new IPCHost(process);
const com = new Communication(ipcHost, 'process');
com.registerAPI(
    { id: 'myApi' },
    {
        echo: () => 'yo',
    }
);
