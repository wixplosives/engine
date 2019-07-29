import { ForkedProcess } from './forked-process';
import { RemoteProcess } from './types';

export async function getParentProcess(): Promise<RemoteProcess | null> {
    try {
        const WorkerThreads = await import('worker_threads');
        return WorkerThreads.parentPort;
    } catch {
        if (process.send) {
            return new ForkedProcess(process);
        }
        return null;
    }
}
