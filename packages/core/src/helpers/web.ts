import type { IRunOptions } from '../types.js';

export function injectScript(win: Window, rootComId: string, scriptUrl: string) {
    return new Promise<Window>((res, rej) => {
        // This is the contract of the communication to get the root communication id
        win.name = rootComId;
        const scriptEl = win.document.createElement('script');
        scriptEl.src = scriptUrl;
        scriptEl.onload = () => res(win);
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        scriptEl.onerror = (e) => rej(e);
        win.document.head.appendChild(scriptEl);
    });
}

interface EngineWebEntryGlobalObj {
    document?: {
        querySelector?: Document['querySelector'];
        currentScript: {
            dataset: { engineRunOptions?: string | null };
        } | null;
    };
    location?: { search?: string };

    engineEntryOptions?: (options: { currentRunOptions: IRunOptions; envName: string }) => IRunOptions;
}

export function getEngineEntryOptions(envName: string, globalObj: EngineWebEntryGlobalObj): IRunOptions {
    const urlParams = new URLSearchParams(globalObj?.location?.search);
    const currentScript =
        globalObj?.document?.currentScript ??
        (typeof import.meta !== 'undefined' && import.meta.url
            ? // if env run as a module then in has no access to currentScript, in this case we find script by src
              globalObj?.document?.querySelector?.<HTMLElement>(`script[src="${import.meta.url}"]`)
            : undefined);

    const optionsFromScript = new URLSearchParams(
        (currentScript && currentScript.dataset.engineRunOptions) || undefined,
    );
    const optionsBeforeInject = new Map([...optionsFromScript, ...urlParams]);
    const optionsAfterInject = globalObj?.engineEntryOptions?.({
        currentRunOptions: optionsBeforeInject,
        envName,
    });
    return optionsAfterInject || optionsBeforeInject;
}
