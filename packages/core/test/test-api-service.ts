import { SERVICE_CONFIG } from '../src';
import { multiTenantMethod } from '../src/com/multi-tenant';

export interface ITestServiceData {
    echo: number[];
}

export class TestService {
    private listeners: Array<(x: ITestServiceData) => void> = [];
    public testApi(a: number, b: number, c: number): ITestServiceData {
        const args = [a, b, c];
        return this.listeners.reduce(
            (res, fn) => {
                fn(res);
                return res;
            },
            { echo: args }
        );
    }
    public listen(fn: (x: ITestServiceData) => void) {
        this.listeners.push(fn);
    }
}

export class MultiTenantTestService {
    public [SERVICE_CONFIG] = {
        multiTenantFunction: multiTenantMethod(this.multiTenantFunction)
    };
    public multiTenantFunction(id: string, anotherArg: string): { [key: string]: string } {
        return {
            id,
            anotherArg
        };
    }

    public singleTenantFunction(id: string, anotherArg: string): { [key: string]: string } {
        return {
            id,
            anotherArg
        };
    }
}

export const testServiceId = 'TestService';

export const multiTanentServiceId = 'MultiTanentService';
