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

export function getEngineEntryOptions(envName: string) {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const currentScript = globalThis.document?.currentScript
    const isHtmlScript = !!currentScript && 'src' in currentScript;

    const scriptQueryString = isHtmlScript && currentScript.src?.split?.('?')?.[1] || ''
    const scriptUrlParams = new URLSearchParams(scriptQueryString)
    const injectedOptions = globalThis.engineEntryOptions?.({ urlParams, envName }) ?? new URLSearchParams('');

    const definedParams = new Set<string>()
    return new URLSearchParams([...injectedOptions, ...urlParams, ...scriptUrlParams].filter(([key]) => {
        if (definedParams.has(key)) {
            return false
        }
        definedParams.add(key)
        return true
    }))
}
