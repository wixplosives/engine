declare const __webpack_public_path__: string;

export async function loadConfig(fileName: string, envName: string) {
    const configFileName = envName ? `${fileName}.${envName}` : fileName;
    const url = `${__webpack_public_path__}configs/${configFileName}.json`;
    const resp = await fetch(url);
    const config = (await resp.json()) as unknown as { [key: string]: string };
    return config;
}
