import { once } from 'node:events';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

/**
 * Imports a module and returns its exports. The module is executed in a new worker thread.
 * This ensures that the module and its dependencies are completely reloaded.
 * @param filePath - The path to the module to import.
 * @returns A Promise that resolves to the exports of the imported module.
 */
export async function importFresh(filePath: string): Promise<unknown> {
    const worker = new Worker(__filename, { workerData: filePath });
    const [imported] = await once(worker, 'message');
    await worker.terminate();
    return imported;
}

if (!isMainThread && typeof workerData === 'string') {
    import(workerData)
        .then((moduleExports) => parentPort?.postMessage(moduleExports))
        .catch((e) => parentPort?.emit('error', e));
}
