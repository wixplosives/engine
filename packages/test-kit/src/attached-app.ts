import { IFeatureTarget } from '@wixc3/engine-scripts';
import { request } from 'http';
import { IExecutableApplication } from './types';

const NODE_ENV_PATH = '/node-env';

interface IEnvironmentHttpCall {
    method: 'PUT' | 'DELETE' | 'GET';
    path?: string;
    featureTarget?: IFeatureTarget;
}

export class AttachedApp implements IExecutableApplication {
    constructor(private port: number, private hostname = 'localhost') {}
    public async getServerPort() {
        await this.makeEnvironmentHttpCall({ method: 'GET', path: '/' });
        return this.port;
    }

    public runFeature(featureTarget: IFeatureTarget) {
        return this.makeEnvironmentHttpCall({ featureTarget, method: 'PUT' });
    }

    public closeFeature(featureTarget: IFeatureTarget) {
        return this.makeEnvironmentHttpCall({ featureTarget, method: 'DELETE' });
    }

    public async closeServer() {
        /* We don't close the running app */
    }

    private makeEnvironmentHttpCall({ method, path = NODE_ENV_PATH, featureTarget }: IEnvironmentHttpCall) {
        return new Promise<void>((resolve, reject) => {
            const req = request(
                {
                    method,
                    hostname: this.hostname,
                    path,
                    port: this.port,
                    headers: {
                        'Content-type': 'application/json'
                    }
                },
                res => {
                    res.on('data', () => {
                        /* if the server had errors when launching, it will reject. if we received any data, it means the server launched */
                    });
                    res.on('end', resolve);
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
