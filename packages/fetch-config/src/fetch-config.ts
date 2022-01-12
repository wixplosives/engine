function normalizeRoute(route: string) {
    return route + (route && !route.endsWith('/') ? '/' : '');
}

export default async function fetchConfigs(
    baseRoute: string, 
    featureName: string, 
    envName: string, 
    configName: string
) {
    const resp = await fetch(`${normalizeRoute(baseRoute)}${configName}?env=${envName}&featureName=${featureName}`);
    const config: { [key: string]: string } = (await resp.json() as unknown as { [key: string]: string });
    return config;
}

