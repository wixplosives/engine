import {
    IFeatureMessage,
    IFeatureTarget,
    isPortMessage,
    isProcessMessage,
    ProcessMessageId
} from '@wixc3/engine-scripts';
import { ChildProcess, fork } from 'child_process';
import { IExecutableApplication } from './types';

export class DetachedApp implements IExecutableApplication {
    private engineStartProcess: ChildProcess | undefined;
    private port: number | undefined;
    private featureId: number | undefined;

    constructor(private cliEntry: string, private basePath: string) {}

    public async startServer() {
        if (this.port) {
            throw new Error('The server is already running.');
        }
        const execArgv = process.argv.some(arg => arg.startsWith('--inspect')) ? ['--inspect'] : [];

        const engineStartProcess = fork(this.cliEntry, ['start'], {
            stdio: 'inherit',
            cwd: this.basePath,
            execArgv
        });

        this.engineStartProcess = engineStartProcess;

        this.port = await new Promise<number>((resolve, reject) => {
            engineStartProcess.once('message', message => {
                if (isPortMessage(message)) {
                    resolve(message.payload.port);
                } else {
                    reject(new Error('Invalid message was received for start server command'));
                }
            });
        });

        return this.port;
    }

    public async closeServer() {
        const { engineStartProcess } = this;
        if (!engineStartProcess) {
            throw new Error('Engine is not started yet');
        }
        // socket server hangs on close on CIs for some reason
        // await this.waitForProcessMessage('server-disconnected', p => {
        //     p.send({ id: 'server-disconnect' });
        // });
        await new Promise((res, rej) => {
            engineStartProcess.once('error', rej);
            engineStartProcess.once('exit', res);
            engineStartProcess.kill();
        });
        this.engineStartProcess = undefined;
    }

    public async runFeature({ configName, featureName, projectPath }: IFeatureTarget) {
        const { id } = (await this.waitForProcessMessage('feature-initialized', p => {
            p.send({
                id: 'run-feature',
                payload: { configName, featureName, projectPath }
            });
        })) as IFeatureMessage;

        this.featureId = id;
    }

    public async closeFeature() {
        await this.waitForProcessMessage('feature-closed', p => {
            p.send({ id: 'close-feature', payload: { id: this.featureId } });
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
