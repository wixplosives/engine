import { ChildProcess, fork } from 'child_process';
import { on } from 'events';
import { PerformanceMetrics, ProcessMessageId, isProcessMessage, IProcessMessage } from '@wixc3/engine-runtime-node';
import type { IFeatureTarget, IPortMessage, IFeatureMessagePayload } from '@wixc3/engine-scripts';
import type { IExecutableApplication } from './types';

export class DetachedApp implements IExecutableApplication {
    private engineStartProcess: ChildProcess | undefined;
    private port: number | undefined;

    constructor(private cliEntry: string, private basePath: string, private featureDiscoveryRoot?: string) {}

    public async getServerPort() {
        if (this.port) {
            throw new Error('The server is already running.');
        }
        const execArgv = process.argv.some((arg) => arg.startsWith('--inspect')) ? ['--inspect'] : [];

        const args = ['start', '--engineerEntry', 'engineer/managed'];

        if (this.featureDiscoveryRoot) {
            args.push('--featureDiscoveryRoot');
            args.push(this.featureDiscoveryRoot);
        }

        this.engineStartProcess = fork(this.cliEntry, args, {
            stdio: 'inherit',
            cwd: this.basePath,
            execArgv,
        });

        this.send({ id: 'port-request' });
        const { port } = (await this.waitForProcessMessage('port-request')) as IPortMessage;
        this.port = port;
        return this.port;
    }

    public async closeServer() {
        this.send({ id: 'server-disconnect' });
        await this.waitForProcessMessage('server-disconnected');
        this.engineStartProcess = undefined;
    }

    public async runFeature(payload: IFeatureTarget) {
        this.send({
            id: 'run-feature',
            payload,
        });
        return (await this.waitForProcessMessage('feature-initialized')) as IFeatureMessagePayload;
    }

    public async closeFeature(payload: IFeatureTarget) {
        this.send({ id: 'close-feature', payload });
        await this.waitForProcessMessage('feature-closed');
    }

    public async getMetrics() {
        this.send({ id: 'metrics-request' });
        return (await this.waitForProcessMessage('metrics-response')) as PerformanceMetrics;
    }

    private send(data: IProcessMessage<unknown>): void {
        const { engineStartProcess } = this;
        if (!engineStartProcess) {
            throw new Error('Engine is not started yet');
        }
        engineStartProcess.send(data);
    }

    private async waitForProcessMessage(messageId: ProcessMessageId): Promise<unknown> {
        const { engineStartProcess } = this;
        if (!engineStartProcess) {
            throw new Error('Engine is not started yet');
        }
        for await (const [message] of on(engineStartProcess, 'message')) {
            if (isProcessMessage(message) && message.id === messageId) {
                return message.payload;
            }
        }
        throw new Error(`didn't get message id: ${messageId}`);
    }
}
