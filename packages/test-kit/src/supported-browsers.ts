const supportedBrowsers = ['chromium', 'firefox', 'webkit'] as const;
export type SupportedBrowser = typeof supportedBrowsers[number];

export function isValidBrowserName(browserName: string): browserName is SupportedBrowser {
    return (supportedBrowsers as ReadonlyArray<string>).includes(browserName);
}
export function validateBrowser(name: string): SupportedBrowser {
    if (isValidBrowserName(name)) {
        return name;
    }
    throw new Error(`Invalid browser name was entered as env var: ${name} \n
                    Possible options for browsers are: ${supportedBrowsers.join(', ')}.`);
}
