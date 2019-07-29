import {
    Application,
    IFeatureMessage,
    IFeatureTarget,
    IPortMessage,
    isProcessMessage,
    ProcessMessageId
} from '@wixc3/engine-scripts/src';
import { ChildProcess, fork } from 'child_process';

export interface IExecutableApplication {
    startServer(): Promise<number>;
    runFeature(featureTarget: IFeatureTarget): Promise<void>;
    closeFeature(): Promise<void>;
    closeServer(): Promise<void>;
}

export class ProcessApp implements IExecutableApplication {
    private engineStartProcess: ChildProcess;
    private port: number | undefined;
    private featureId: number | undefined;

    constructor(private cliEntry: string, basePath: string) {
        this.engineStartProcess = fork(this.cliEntry, ['start-engine-server'], {
            stdio: 'inherit',
            cwd: basePath,
            execArgv: [
                // '--inspect-brk',
                // '--trace-warnings'
            ]
        });
    }

    public async startServer() {
        if (!this.port) {
            const { port } = (await this.waitForProcessMessage('port')) as IPortMessage;
            this.port = port;
        }
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
            throw new Error('server is not initialized yet');
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

export class LocalApp implements IExecutableApplication {
    private application: Application;
    private disposeServer: (() => Promise<void>) | undefined;
    private disposeFeature: (() => Promise<void>) | undefined;
    private runFeatureHandler: ((target: IFeatureTarget) => Promise<{ close: () => Promise<void> }>) | undefined;

    constructor(basePath: string = process.cwd()) {
        process.chdir(basePath);
        this.application = new Application(basePath);
    }

    public async startServer() {
        const { port, runFeature, close } = await this.application.start();
        this.disposeServer = close;
        this.runFeatureHandler = runFeature;
        return port;
    }

    public async runFeature(featureTarget: IFeatureTarget) {
        if (!this.runFeatureHandler) {
            throw new Error(`server wasn't initialized`);
        }
        const { close } = await this.runFeatureHandler(featureTarget);
        this.disposeFeature = close;
    }

    public async closeFeature() {
        if (this.disposeFeature) {
            return this.disposeFeature();
        }
    }

    public async closeServer() {
        if (this.disposeServer) {
            return this.disposeServer();
        }
    }
}
