declare const __webpack_public_path__: string; 

function normalizeRoute(route: string) {
    return route + (route && !route.endsWith('/') ? '/' : '');
}

export async function fetchConfigs(
    baseRoute: string, 
    featureName: string, 
    envName: string, 
    configName: string
) {
    const resp = await fetch(`${normalizeRoute(baseRoute)}${configName}?env=${envName}&featureName=${featureName}`);
    const config: { [key: string]: string } = (await resp.json() as unknown as { [key: string]: string });
    return config;
}

export async function fetchTopLevelConfigs(
    fileName: string, 
    envName: string, 
) {
    const configFileName = envName ? `${fileName}.${envName}` : fileName;
    const url = `${__webpack_public_path__}configs/${configFileName}.json`;
    const resp = await fetch(url);
    const config = (await resp.json() as unknown as { [key: string]: string });
    return config;
}