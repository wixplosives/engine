import {
    IFeatureMessage,
    IFeatureTarget,
    IPortMessage,
    isProcessMessage,
    ProcessMessageId
} from '@wixc3/engine-scripts/src';
import { ChildProcess, fork } from 'child_process';
import { IExecutableApplication } from './types';

export class DetachedApp implements IExecutableApplication {
    private engineStartProcess: ChildProcess;
    private port: number | undefined;
    private featureId: number | undefined;

    constructor(private cliEntry: string, basePath: string) {
        const execArgv = process.argv.some(arg => arg.includes('inspect')) ? ['--inspect'] : [];

        this.engineStartProcess = fork(this.cliEntry, ['start-engine-server'], {
            stdio: 'inherit',
            cwd: basePath,
            execArgv
        });
    }

    public async startServer() {
        if (this.port) {
            throw new Error('The server is already running.');
        }
        const { port } = (await this.waitForProcessMessage('port')) as IPortMessage;

        this.port = port;

        return this.port;
    }

    public async closeServer() {
        this.engineStartProcess.send({ id: 'server-disconnect' });
        await this.waitForProcessMessage('server-disconnected');
        await new Promise((resolve, reject) => {
            this.engineStartProcess.kill();
            this.engineStartProcess.once('exit', () => {
                this.engineStartProcess.off('error', reject);
                resolve();
            });
            this.engineStartProcess.once('error', reject);
        });
    }

    public async runFeature({ configName, featureName, projectPath }: IFeatureTarget) {
        if (!this.port) {
            throw new Error(
                `server is not initialized yet, cant process runFeature for feature '${featureName} 'with '${configName}' config`
            );
        }
        this.engineStartProcess.send({
            id: 'run-feature',
            payload: { configName, featureName, projectPath }
        });

        const { id } = (await this.waitForProcessMessage('feature-initialized')) as IFeatureMessage;
        this.featureId = id;
    }

    public async closeFeature() {
        this.engineStartProcess.send({ id: 'close-feature', payload: { id: this.featureId } });
        await this.waitForProcessMessage('feature-closed');
    }

    private async waitForProcessMessage(messageId: ProcessMessageId): Promise<unknown> {
        return new Promise<unknown>((resolve, reject) => {
            const onMessage = (message: unknown) => {
                if (isProcessMessage(message) && message.id === messageId) {
                    this.engineStartProcess.off('message', onMessage);
                    this.engineStartProcess.off('error', reject);
                    this.engineStartProcess.off('exit', reject);
                    resolve(message.payload);
                }
            };
            this.engineStartProcess.on('message', onMessage);
            this.engineStartProcess.once('error', reject);
            this.engineStartProcess.once('exit', reject);
        });
    }
}
