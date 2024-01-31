function init() {
    fetch('/api/engine/metadata')
        .then((response) => response.json())
        .then((data) => {
            byId('raw-data-content').textContent = JSON.stringify(data, null, 2);
            updateUI(data);
        })
        .catch(uiError);
}

function el(
    tag: string,
    attributes: Record<string, string | ((this: HTMLElement, e: unknown) => void)> = {},
    children: (HTMLElement | Text)[] = [],
) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
        if (typeof value === 'function') {
            (element as any)[key] = value;
            continue;
        }
        element.setAttribute(key, String(value));
    }
    for (const child of children) {
        element.appendChild(child);
    }
    return element;
}
function text(text: string) {
    return document.createTextNode(text);
}

function byId(id: string) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Element with id ${id} not found`);
    }
    return el;
}

function updateUI(data: any) {
    const features = Object.keys(data.featureEnvironmentsMapping.featureToEnvironments);
    const configs = Object.keys(data.configMapping);
    const openManagers = data.openManagers;
    populateDatalistOptions(configs, 'config-name-list');
    populateFeatureTable(features);
    populateOpenEnvs(openManagers);
    populatePreviousRuns();
    setupSearch();
}

function setupSearch() {
    const input = byId('feature-search') as HTMLInputElement;
    input.value = localStorage.getItem('feature-search') ?? '';
    const onInput = () => {
        const search = input.value;
        localStorage.setItem('feature-search', search);
        const searchReg = new RegExp(search.replace(/(\w)/g, `$1.*?`), 'i');
        const featureTable = byId('feature-table-content').querySelectorAll('tr[data-feature-name]');
        for (const tr of Array.from(featureTable) as Array<HTMLTableRowElement>) {
            const featureName = String(tr.dataset.featureName);
            tr.style.display = featureName.match(searchReg) ? '' : 'none';
        }
    };
    input.oninput = onInput;
    onInput();
}

function populateOpenEnvs(
    openManagers: { featureName: string; configName: string; runtimeArgs: string; port: number; url: string }[],
) {
    const content = byId('open-environments-content');
    content.innerHTML = '';
    openManagers.forEach(({ featureName, configName, runtimeArgs, url }) => {
        const row = el('tr', {}, [
            el('td', {}, [text(featureName)]),
            el('td', {}, [text(configName)]),
            el('td', {}, [el('pre', {}, [text(JSON.stringify(JSON.parse(runtimeArgs), null, 2))])]),
            el('td', {}, [el('a', { href: url, target: '_blank' }, [text(url)])]),
            el('td', {}, [
                el(
                    'button',
                    {
                        onclick() {
                            runEnvironment(this as HTMLButtonElement, featureName, configName, runtimeArgs);
                        },
                    },
                    [text('Restart')],
                ),
            ]),
        ]);
        content.appendChild(row);
    });
}

type PreviousRuns = {
    featureName: string;
    configName: string;
    runtimeArgs: string;
}[];

function getFavorites() {
    return JSON.parse(localStorage.getItem('favorites') || '[]') as PreviousRuns;
}

function saveFavorite(featureName: string, configName: string, runtimeArgs: string) {
    const fav = getFavorites();
    const exists = fav.find(
        (f) => f.featureName === featureName && f.configName === configName && f.runtimeArgs === runtimeArgs,
    );
    if (!exists) {
        fav.unshift({ featureName, configName, runtimeArgs });
        localStorage.setItem('favorites', JSON.stringify(fav));
        populatePreviousRuns();
    }
}

function deleteFavorite(featureName: string, configName: string, runtimeArgs: string) {
    const favorites = getFavorites();
    const index = favorites.findIndex(
        (f) => f.featureName === featureName && f.configName === configName && f.runtimeArgs === runtimeArgs,
    );
    if (index >= 0) {
        favorites.splice(index, 1);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        populatePreviousRuns();
    }
}

function populatePreviousRuns() {
    const previousRuns = getFavorites();
    const content = byId('previous-runs-content');
    content.innerHTML = '';
    previousRuns.forEach(({ featureName, configName, runtimeArgs }) => {
        const row = el('tr', {}, [
            el('td', {}, [text(featureName)]),
            el('td', {}, [text(configName)]),
            el('td', {}, [el('pre', {}, [text(JSON.stringify(JSON.parse(runtimeArgs), null, 2))])]),
            el('td', {}, [
                el(
                    'button',
                    {
                        onclick() {
                            runEnvironment(this as HTMLButtonElement, featureName, configName, runtimeArgs);
                        },
                    },
                    [text('Run')],
                ),
            ]),
            el('td', {}, [
                el(
                    'button',
                    {
                        onclick() {
                            deleteFavorite(featureName, configName, runtimeArgs);
                        },
                    },
                    [text('Delete')],
                ),
            ]),
        ]);
        content.appendChild(row);
    });
}

function populateFeatureTable(features: string[]) {
    const featureTable = byId('feature-table-content');
    featureTable.innerHTML = '';
    features.sort().forEach((featureName) => {
        const row = el('tr', { 'data-feature-name': featureName }, [
            el('td', {}, [text(featureName)]),
            el('td', {}, [
                el('input', {
                    placeholder: 'Config name',
                    list: 'config-name-list',
                    value: getSavedConfigName(featureName),
                    onchange() {
                        saveConfigName(featureName, (this as HTMLInputElement).value);
                    },
                }),
            ]),
            el('td', {}, [
                el('input', {
                    placeholder: 'Runtime args',
                    value: localStorage.getItem(featureName + ':runtimeArgs') ?? '',
                    onchange() {
                        localStorage.setItem(featureName + ':runtimeArgs', (this as HTMLInputElement).value);
                    },
                }),
            ]),
            el('td', {}, [
                el(
                    'button',
                    {
                        onclick() {
                            runEnvironment(this as HTMLButtonElement, featureName, getSavedConfigName(featureName), '');
                        },
                    },
                    [text('Run')],
                ),
            ]),
        ]);
        featureTable.appendChild(row);
    });
}

function runEnvironment(btn: HTMLButtonElement, featureName: string, configName: string, runtimeArgs: string) {
    btn.disabled = true;
    saveFavorite(featureName, configName, runtimeArgs);
    fetch('/api/engine/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            featureName,
            configName,
            runtimeArgs,
        }),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.error) {
                throw new Error(data.error);
            }
            populateOpenEnvs(data.openManagers);
            window.open(data.url, '_blank');
        })
        .catch(uiError)
        .finally(() => {
            btn.disabled = false;
        });
}

function populateDatalistOptions(options: string[], id: string) {
    const dataList = byId(id);
    dataList.innerHTML = '';
    options.sort().forEach((option) => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        dataList.appendChild(optionElement);
    });
}

function uiError(error: any) {
    byId('error').textContent = error.stack || error.message || error;
}

function getSavedConfigName(featureName: string) {
    return localStorage.getItem(featureName + ':configName') ?? '';
}

function saveConfigName(featureName: string, configName: string) {
    localStorage.setItem(featureName + ':configName', configName);
}

init();
