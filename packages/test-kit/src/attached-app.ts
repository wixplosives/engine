import type {
    IFeatureTarget,
    IProcessMessage,
    IFeatureMessagePayload,
    PerformanceMetrics,
} from '@wixc3/engine-scripts';
import { request } from 'http';
import type { IExecutableApplication } from './types';
import { join } from 'path';

const NODE_ENV_PATH = '/engine-feature';

interface IEnvironmentHttpCall {
    method: 'PUT' | 'POST' | 'GET';
    path?: string;
    featureTarget?: IFeatureTarget;
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

    public async getMetrics() {
        return this.makeEnvironmentHttpCall<PerformanceMetrics>({
            method: 'GET',
            path: join(NODE_ENV_PATH, 'metrics'),
        });
    }

    private makeEnvironmentHttpCall<ResponseType>({
        method,
        path = NODE_ENV_PATH,
        featureTarget,
    }: IEnvironmentHttpCall) {
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
                        responseChunks.push(chunk.toString());
                    });
                    res.on('end', () => {
                        if (path.includes(NODE_ENV_PATH)) {
                            const response = JSON.parse(responseChunks.join()) as IProcessMessage<ResponseType>;
                            resolve(response.payload);
                        } else {
                            resolve();
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
