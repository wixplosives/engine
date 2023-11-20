import { isProcessMessage, type PerformanceMetrics, type ProcessMessageId } from '@wixc3/engine-runtime-node';
import {
    resolveExecArgv,
    type IFeatureMessagePayload,
    type IFeatureTarget,
    type IPortMessage,
} from '@wixc3/engine-scripts';
import { ChildProcess, fork } from 'node:child_process';
import type { IExecutableApplication } from './types.js';

export class ForkedProcessApplication implements IExecutableApplication {
    private engineStartProcess: ChildProcess | undefined;
    private port: number | undefined;

    constructor(
        private cliEntry: string,
        private basePath: string,
        private featureDiscoveryRoot?: string,
    ) {}

    public async getServerPort() {
        if (this.port) {
            throw new Error('The server is already running.');
        }

        const args = ['start', '--engineerEntry', 'engineer/managed'];

        if (this.featureDiscoveryRoot) {
            args.push('--featureDiscoveryRoot');
            args.push(this.featureDiscoveryRoot);
        }
        const execArgv = await resolveExecArgv(this.basePath);

        this.engineStartProcess = fork(this.cliEntry, args, {
            stdio: 'inherit',
            cwd: this.basePath,
            execArgv,
        });

        const { port } = await this.waitForProcessMessage<IPortMessage>('port-request', (p) =>
            p.send({ id: 'port-request' }),
        );

        this.port = port;

        return this.port;
    }

    public async closeServer() {
        await this.waitForProcessMessage('server-disconnected', (p) => {
            p.send({ id: 'server-disconnect' });
        });
        this.engineStartProcess = undefined;
    }

    public async runFeature(payload: IFeatureTarget) {
        const res = await this.waitForProcessMessage<IFeatureMessagePayload>('feature-initialized', (p) => {
            p.send({
                id: 'run-feature',
                payload,
            });
        });
        return {
            ...res,
            dispose: () => this.closeFeature(res),
            getMetrics: () => this.getMetrics(),
        };
    }

    public async closeFeature(payload: IFeatureTarget) {
        await this.waitForProcessMessage('feature-closed', (p) => {
            p.send({ id: 'close-feature', payload });
        });
    }
    // NOTE: this does not support parallel runs
    private async getMetrics() {
        return this.waitForProcessMessage<PerformanceMetrics>('metrics-response', (p) => {
            p.send({ id: 'metrics-request' });
        });
    }

    private async waitForProcessMessage<T>(
        messageId: ProcessMessageId,
        action?: (appProcess: ChildProcess) => void,
    ): Promise<T> {
        const { engineStartProcess } = this;
        if (!engineStartProcess) {
            throw new Error(
                'Engine is not started yet, Make sure you call withFeature / getRunningFeature / withLocalFixture outside of the test function',
            );
        }
        return new Promise<T>((resolve, reject) => {
            const onMessage = (message: unknown) => {
                if (isProcessMessage(message) && message.id === messageId) {
                    engineStartProcess.off('message', onMessage);
                    engineStartProcess.off('exit', reject);
                    engineStartProcess.off('error', reject);
                    resolve(message.payload as T);
                }
            };
            engineStartProcess.on('message', onMessage);
            engineStartProcess.once('error', reject);
            engineStartProcess.once('exit', reject);
            if (action) {
                action(engineStartProcess);
            }
        });
    }
}
