import { IFeatureTarget } from '@wixc3/engine-scripts';
import { get, request } from 'http';
import { IExecutableApplication } from './types';

const NODE_ENV_PATH = '/node-env';

export class AttachedApp implements IExecutableApplication {
    constructor(private port: number) {}
    public startServer() {
        return new Promise<number>((resolve, reject) => {
            const req = get(`http://localhost:${this.port}`, res => {
                res.on('data', () => {
                    /** */
                });

                res.on('end', () => {
                    resolve(this.port);
                });
                res.on('error', err => {
                    reject(err);
                });
            });

            req.on('error', err => {
                reject(err);
            });
        });
    }

    public runFeature(featureTarget: IFeatureTarget) {
        return new Promise<void>((resolve, reject) => {
            const req = request(
                {
                    method: 'PUT',
                    hostname: 'localhost',
                    path: NODE_ENV_PATH,
                    headers: {
                        'Content-type': 'application/json'
                    },
                    port: this.port
                },
                res => {
                    res.on('data', () => {
                        /** */
                    });

                    res.on('end', () => {
                        resolve();
                    });
                    res.on('error', reject);
                }
            );
            req.on('error', reject);
            req.write(JSON.stringify(featureTarget));
            req.end();
        });
    }

    public closeFeature(featureTarget: IFeatureTarget) {
        return new Promise<void>((resolve, reject) => {
            const req = request(
                {
                    method: 'DELETE',
                    hostname: 'localhost',
                    path: NODE_ENV_PATH,
                    port: this.port,
                    headers: {
                        'Content-type': 'application/json'
                    }
                },
                res => {
                    res.on('data', () => {
                        /** */
                    });
                    res.on('end', () => {
                        resolve();
                    });
                    res.on('error', reject);
                }
            );
            req.on('error', reject);
            req.write(JSON.stringify(featureTarget));
            req.end();
        });
    }

    public async closeServer() {
        // do nothing
    }
}
