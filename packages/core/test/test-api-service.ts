import { SERVICE_CONFIG } from '../src';
import { multiTenantMethod } from '../src/com/service-config';

export interface ITestServiceData {
    echo: number[];
}

export class TestService {
    private listeners: Array<(x: ITestServiceData) => void> = [];
    public testApi(a: number, b: number, c: number): ITestServiceData {
        const data: ITestServiceData = { echo: [a, b, c] };
        for (const listener of this.listeners) {
            listener(data);
        }
        return data;
    }
    public listen(fn: (x: ITestServiceData) => void) {
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
