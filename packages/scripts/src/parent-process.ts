import { ForkedProcess } from './forked-process';
import { RemoteProcess } from './types';

export function getParentProcess(): RemoteProcess | null {
    // this is commented for when we will be able to debug with them.
    // try {
    //     const WorkerThreads = await import('worker_threads');
    //     return WorkerThreads.parentPort;
    // } catch {
    if (process.send) {
        return new ForkedProcess(process);
    }
    return null;
    // }
}
