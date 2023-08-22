import { once } from 'node:events';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

/**
 * Imports a module and returns the value of a specific export.
 * The module is executed in a new worker thread, which ensures that the module and
 * its dependencies are completely reloaded.
 *
 * @param filePath - The path to the module to import.
 * @param exportSymbolName - name of the exported symbol to get the value of. defaults to `"default"`.
 * @returns A Promise that resolves to the exports of the imported module.
 */
export async function importFresh(filePath: string, exportSymbolName = 'default'): Promise<unknown> {
    const worker = new Worker(__filename, {
        workerData: { filePath, exportSymbolName } satisfies ImportFreshWorkerData,
    });
    const [imported] = await once(worker, 'message');
    await worker.terminate();
    return imported;
}

if (!isMainThread && isImportWorkerData(workerData)) {
    const { filePath, exportSymbolName } = workerData;
    import(filePath)
        .then((moduleExports) => parentPort?.postMessage(moduleExports[exportSymbolName]))
        .catch((e) => {
            throw e;
        });
}

interface ImportFreshWorkerData {
    filePath: string;
    exportSymbolName: string;
}

function isImportWorkerData(value: unknown): value is ImportFreshWorkerData {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as ImportFreshWorkerData).filePath === 'string' &&
        typeof (value as ImportFreshWorkerData).exportSymbolName === 'string'
    );
}
