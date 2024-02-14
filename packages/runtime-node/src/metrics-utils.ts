import type { PerformanceMetrics } from './types';
import { parentPort } from 'node:worker_threads';
import type { ChildProcess } from 'node:child_process';
import { Worker } from '@wixc3/isomorphic-worker/worker';
import { isValidRpcMessage, isValidRpcResponse, rpcCall, getNextMessageId } from './micro-rpc';

export function bindUniversalListener<T>(type: string, customFetcher: () => Promise<T> | T) {
    const handler = async (message: unknown) => {
        if (isValidRpcMessage(message) && message.type === type) {
            const outgoingMessage = {
                id: message.id,
                value: await customFetcher(),
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

export function bindMetricsListener(
    customFetcher: () => Promise<PerformanceMetrics> | PerformanceMetrics = localPerformanceFetcher,
) {
    return bindUniversalListener('getMetrics', customFetcher);
}
function localPerformanceFetcher() {
    return {
        marks: performance.getEntriesByType('mark').map((_) => _.toJSON()),
        measures: performance.getEntriesByType('measure').map((_) => _.toJSON()),
    };
}

//TODO: generalize
export async function getMetricsFromProcess(
    managerProcess: ChildProcess,
    timeout = 10000,
): Promise<PerformanceMetrics> {
    return await new Promise((resolve, reject) => {
        const outgoingMessage = { type: 'getMetrics', id: getNextMessageId() };
        const tm = setTimeout(() => {
            managerProcess.off('message', handler);
            reject(new Error(`Timeout after ${timeout / 1000} sec, waiting for getMetrics message.`));
        }, timeout);
        const handler = (responseMessage: unknown) => {
            if (isValidRpcResponse(responseMessage, outgoingMessage.id)) {
                clearTimeout(tm);
                resolve(responseMessage.value as PerformanceMetrics);
            }
        };
        managerProcess.on('message', handler);
        if (!managerProcess.send) {
            throw new Error('managerProcess.send is not defined');
        }
        managerProcess.send(outgoingMessage);
    });
}

export function getMetricsFromWorker(worker: Worker) {
    return rpcCall<PerformanceMetrics>(worker, 'getMetrics', 5000);
}
