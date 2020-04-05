import {
    IFeatureTarget,
    IPortMessage,
    isProcessMessage,
    ProcessMessageId,
    IFeatureMessagePayload,
} from '@wixc3/engine-scripts';
import { ChildProcess, fork } from 'child_process';
import { IExecutableApplication } from './types';

export class DetachedApp implements IExecutableApplication {
    private engineStartProcess: ChildProcess | undefined;
    private port: number | undefined;

    constructor(private cliEntry: string, private basePath: string) {}

    public async getServerPort() {
        if (this.port) {
            throw new Error('The server is already running.');
        }
        const execArgv = process.argv.some((arg) => arg.startsWith('--inspect')) ? ['--inspect'] : [];

        const engineStartProcess = fork(this.cliEntry, ['start', '--singleRun'], {
            stdio: 'inherit',
            cwd: this.basePath,
            execArgv,
        });

        this.engineStartProcess = engineStartProcess;
        const { port } = (await this.waitForProcessMessage('port-request')) as IPortMessage;

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
        return (await this.waitForProcessMessage('feature-initialized', (p) => {
            p.send({
                id: 'run-feature',
                payload,
            });
        })) as IFeatureMessagePayload;
    }

    public async closeFeature(payload: IFeatureTarget) {
        await this.waitForProcessMessage('feature-closed', (p) => {
            p.send({ id: 'close-feature', payload });
        });
    }

    private async waitForProcessMessage(
        messageId: ProcessMessageId,
        action?: (appProcess: ChildProcess) => void
    ): Promise<unknown> {
        const { engineStartProcess } = this;
        if (!engineStartProcess) {
            throw new Error('Engine is not started yet');
        }
        return new Promise<unknown>((resolve, reject) => {
            const onMessage = (message: unknown) => {
                if (isProcessMessage(message) && message.id === messageId) {
                    engineStartProcess.off('message', onMessage);
                    engineStartProcess.off('exit', reject);
                    engineStartProcess.off('error', reject);
                    resolve(message.payload);
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
