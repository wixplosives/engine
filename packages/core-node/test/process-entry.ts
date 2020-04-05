import { Communication } from '@wixc3/engine-core';
import { IPCHost } from '../src/ipc-host';

const ipcHost = new IPCHost(process);
const com = new Communication(ipcHost, 'process');
com.registerAPI(
    { id: 'myApi' },
    {
        echo: () => 'yo',
    }
);
