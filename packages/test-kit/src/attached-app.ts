import { IExecutableApplication } from './types';
import { get, request } from 'http';

export class AttachedApp implements IExecutableApplication {
    private url: string;
    constructor(private port: number) {
        this.url = `http://localhost:${port}`;
    }
    async startServer() {
        return this.port;
    }
}
