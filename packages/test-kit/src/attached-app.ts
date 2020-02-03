import { IFeatureTarget, IProcessMessage, IFeatureMessagePayload } from '@wixc3/engine-scripts';
import { request } from 'http';
import { IExecutableApplication } from './types';

const NODE_ENV_PATH = '/engine-feature';

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

    public async runFeature(featureTarget: IFeatureTarget) {
        return this.makeEnvironmentHttpCall({ featureTarget, method: 'PUT' });
    }

    public async closeFeature(featureTarget: IFeatureTarget) {
        await this.makeEnvironmentHttpCall({ featureTarget, method: 'DELETE' });
    }

    public async closeServer() {
        /* We don't close the running app */
    }

    private makeEnvironmentHttpCall({ method, path = NODE_ENV_PATH, featureTarget }: IEnvironmentHttpCall) {
        return new Promise<IFeatureMessagePayload>((resolve, reject) => {
            const responseChunks: Array<Buffer | string> = [];
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
                    res.on('data', chunk => {
                        /* if the server had errors when launching, it will reject. if we received any data, it means the server launched */
                        responseChunks.push(chunk);
                    });
                    res.on('end', () => {
                        console.log('!!!!', responseChunks);
                        const response = JSON.parse(responseChunks.join()) as IProcessMessage<IFeatureMessagePayload>;
                        console.log('!!!!!!!', response);
                        resolve(response.payload);
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
