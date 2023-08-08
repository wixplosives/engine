import type { Communication, Environment, IRunOptions } from '@wixc3/engine-core';
import type { BrowserWindow } from 'electron';

export interface InitializedBrowserEnvironment {
    id: string;
    dispose: () => void;
    browserWindow: BrowserWindow;
}

export interface IWindowEnvironmentOptions {
    env: Environment;
    browserWindow: BrowserWindow;
    runOptions: IRunOptions;
    communication: Communication;
    featureName?: string;
    configName?: string;
    runtimeArguments?: Record<string, string | number | boolean | undefined | null>;
}
