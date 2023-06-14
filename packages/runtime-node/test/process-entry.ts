import { Communication } from '@wixc3/engine-core';
import { IPCHost } from '@wixc3/engine-runtime-node';

const ipcHost = new IPCHost(process);
const com = new Communication(ipcHost, 'process');
com.registerAPI(
    { id: 'myApi' },
    {
        echo: () => 'yo',
    }
);
