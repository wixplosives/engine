import type { PerformanceMetrics } from './types';
import { parentPort } from 'node:worker_threads';
import type { ChildProcess } from 'node:child_process';
import { Worker } from '@wixc3/isomorphic-worker/worker';

export function bindMetricsListener(
    customFetcher: () => Promise<PerformanceMetrics> | PerformanceMetrics = localPerformanceFetcher,
) {
    const handler = async (message: unknown) => {
        if (isValidGetMetricsMessage(message)) {
            const outgoingMessage = {
                id: message.id,
                metrics: await customFetcher(),
            };
            if (parentPort) {
                parentPort.postMessage(outgoingMessage);
            } else if (process.send) {
                process.send(outgoingMessage);
            } else {
                throw new Error('No parentPort or process.send');
            }
        }
    };
    const wrapped = (message: unknown) => {
        handler(message).catch(console.error);
    };
    (parentPort ?? process).on('message', wrapped);
    return () => {
        (parentPort ?? process).off('message', wrapped);
    };
}

function localPerformanceFetcher() {
    return {
        marks: performance.getEntriesByType('mark').map((_) => _.toJSON()),
        measures: performance.getEntriesByType('measure').map((_) => _.toJSON()),
    };
}

let nextMessageId = 0;
export async function getMetricsFromProcess(
    managerProcess: ChildProcess,
    timeout = 10000,
): Promise<PerformanceMetrics> {
    return await new Promise((resolve, reject) => {
        const outgoingMessage = { type: 'getMetrics', id: nextMessageId++ };
        const tm = setTimeout(() => {
            reject(new Error(`Timeout after ${timeout / 1000} sec, waiting for getMetrics message.`));
        }, timeout);
        managerProcess.on('message', (responseMessage) => {
            if (isValidMetricsResponse(responseMessage, outgoingMessage.id)) {
                clearTimeout(tm);
                resolve(responseMessage.metrics);
            }
        });

        if (!managerProcess.send) {
            throw new Error('managerProcess.send is not defined');
        }
        managerProcess.send(outgoingMessage);
    });
}

export function getMetricsFromWorker(worker: Worker): Promise<PerformanceMetrics> {
    const outgoingMessage = { type: 'getMetrics', id: nextMessageId++ };
    const result = new Promise<PerformanceMetrics>((resolve) => {
        const handler = (event: any) => {
            const responseMessage = event.data;
            if (isValidMetricsResponse(responseMessage, outgoingMessage.id)) {
                worker.removeEventListener('message', handler);
                resolve(responseMessage.metrics);
            }
        };
        worker.addEventListener('message', handler);
    });
    worker.postMessage(outgoingMessage);
    return result;
}

function isValidGetMetricsMessage(message: unknown): message is { type: 'getMetrics'; id: number } {
    return !!(
        message &&
        typeof message === 'object' &&
        'type' in message &&
        'id' in message &&
        message.type === 'getMetrics' &&
        typeof message.id === 'number'
    );
}

function isValidMetricsResponse(
    responseMessage: unknown,
    id: number,
): responseMessage is { id: number; metrics: PerformanceMetrics } {
    return !!(
        responseMessage &&
        typeof responseMessage === 'object' &&
        'id' in responseMessage &&
        'metrics' in responseMessage &&
        id === responseMessage.id
    );
}