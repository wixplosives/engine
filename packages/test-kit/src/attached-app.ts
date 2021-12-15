import { request } from 'http';
import { posix } from 'path';
import type { IFeatureTarget, IFeatureMessagePayload } from '@wixc3/engine-scripts';
import type { IExecutableApplication } from './types';
import type { PerformanceMetrics, IProcessMessage } from '@wixc3/engine-runtime-node';

const { join } = posix;

const NODE_ENV_PATH = '/engine-feature';

export interface IEnvironmentHttpCall<T> {
    method: 'PUT' | 'POST' | 'GET';
    path?: string;
    featureTarget?: IFeatureTarget;
    defaultValue?: T;
}

export class AttachedApp implements IExecutableApplication {
    constructor(private port: number, private hostname = 'localhost') {}
    public async getServerPort() {
        await this.makeEnvironmentHttpCall({ method: 'GET' });
        return this.port;
    }

    public async runFeature(featureTarget: IFeatureTarget) {
        return this.makeEnvironmentHttpCall<IFeatureMessagePayload>({ featureTarget, method: 'PUT' });
    }

    public async closeFeature(featureTarget: IFeatureTarget) {
        await this.makeEnvironmentHttpCall({ featureTarget, method: 'POST' });
    }

    public async closeServer() {
        /* We don't close the running app */
    }

    public async getMetrics(): Promise<PerformanceMetrics> {
        return this.makeEnvironmentHttpCall<PerformanceMetrics>({
            method: 'GET',
            path: join(NODE_ENV_PATH, 'metrics'),
            defaultValue: { marks: [], measures: [] },
        });
    }

    private makeEnvironmentHttpCall<ResponseType>({
        method,
        path = NODE_ENV_PATH,
        featureTarget,
        defaultValue = {} as ResponseType,
    }: IEnvironmentHttpCall<ResponseType>) {
        return new Promise<ResponseType>((resolve, reject) => {
            const responseChunks: Array<string> = [];
            const req = request(
                {
                    method,
                    hostname: this.hostname,
                    path,
                    port: this.port,
                    headers: {
                        'Content-type': 'application/json',
                    },
                },
                (res) => {
                    res.on('data', (chunk) => {
                        /* if the server had errors when launching, it will reject. if we received any data, it means the server launched */
                        responseChunks.push((chunk as Buffer).toString());
                    });
                    res.on('end', () => {
                        if (path.includes(NODE_ENV_PATH)) {
                            const response = JSON.parse(responseChunks.join()) as IProcessMessage<ResponseType>;
                            resolve(response.payload);
                        } else {
                            resolve(defaultValue);
                        }
                    });
                    res.on('error', reject);
                }
            );
            req.on('error', reject);
            if (featureTarget) {
                req.write(JSON.stringify(featureTarget));
            }
            req.end();
        });
    }
}
