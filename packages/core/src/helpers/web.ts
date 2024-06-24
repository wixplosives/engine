import { IRunOptions } from '../types';

export function injectScript(win: Window, rootComId: string, scriptUrl: string) {
    return new Promise<Window>((res, rej) => {
        // This is the contract of the communication to get the root communication id
        win.name = rootComId;
        const scriptEl = win.document.createElement('script');
        scriptEl.src = scriptUrl;
        scriptEl.onload = () => res(win);
        scriptEl.onerror = (e) => rej(e);
        win.document.head.appendChild(scriptEl);
    });
}

interface EngineWebEntryGlobalObj {
    document?: Document,
    location?: Location

    engineEntryOptions(options: { urlParams: URLSearchParams; envName: string }): IRunOptions;
}

export function getEngineEntryOptions(envName: string, globalObj: EngineWebEntryGlobalObj): IRunOptions {
    const urlParams = new URLSearchParams(globalObj?.location?.search);
    const currentScript = globalObj?.document?.currentScript;

    const optionsFromScript = new URLSearchParams(currentScript && currentScript.dataset.engineRunOptions || undefined);
    const injectedOptions = globalObj?.engineEntryOptions?.({ urlParams, envName }) ?? new URLSearchParams('');

    return new Map([...optionsFromScript, ...urlParams, ...injectedOptions]);
}
