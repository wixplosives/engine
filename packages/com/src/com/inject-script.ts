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
