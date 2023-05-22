import { SERVICE_CONFIG, multiTenantMethod } from '@wixc3/engine-core';

export interface TestServiceData {
    echo: number[];
}

export class TestService {
    private listeners: Array<(x: TestServiceData) => void> = [];
    public testApi(a: number, b: number, c: number): TestServiceData {
        const data: TestServiceData = { echo: [a, b, c] };
        for (const listener of this.listeners) {
            listener(data);
        }
        return data;
    }
    public failWithError(): void {
        const error = new Error();
        Object.assign(error, testServiceError);
        throw error;
    }
    public listen(fn: (x: TestServiceData) => void) {
        this.listeners.push(fn);
    }
}

export class MultiTenantTestService {
    public [SERVICE_CONFIG] = {
        multiTenantFunction: multiTenantMethod(this.multiTenantFunction),
    };
    public multiTenantFunction(id: string, anotherArg: string): { [key: string]: string } {
        return {
            id,
            anotherArg,
        };
    }

    public singleTenantFunction(id: string, anotherArg: string): { [key: string]: string } {
        return {
            id,
            anotherArg,
        };
    }
}

export class HashParamsRetriever {
    public getHashParams() {
        return location.hash;
    }
}

export const testServiceId = 'TestService';

export const multiTanentServiceId = 'MultiTanentService';

export const hashParamsRetriever = 'HashParamsRetriever';

export const testServiceError = {
    name: 'TestServiceError',
    message: 'test service error',
    code: 1,
};
