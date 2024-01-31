function init() {
    fetch('/api/engine/metadata')
        .then((response) => response.json())
        .then((data) => {
            byId('raw-data-content').textContent = JSON.stringify(data, null, 2);
            updateUI(data);
        })
        .catch(uiError);
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
        const tr = document.createElement('tr');
        const feature = document.createElement('td');
        feature.textContent = featureName;
        const config = document.createElement('td');
        config.textContent = configName;

        const runtimeArgsEl = document.createElement('td');
        runtimeArgsEl.textContent = runtimeArgs;

        const urlEl = document.createElement('td');
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.textContent = url;
        const restart = document.createElement('td');
        const restartBtn = document.createElement('button');
        restartBtn.textContent = 'Restart';
        restartBtn.onclick = () => {
            runEnvironment(restartBtn, featureName, configName, runtimeArgs);
        };
        restart.appendChild(restartBtn);
        urlEl.appendChild(link);
        tr.appendChild(feature);
        tr.appendChild(config);
        tr.appendChild(runtimeArgsEl);
        tr.appendChild(urlEl);
        tr.appendChild(restart);
        content.appendChild(tr);
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
        const tr = document.createElement('tr');
        const feature = document.createElement('td');
        feature.textContent = featureName;
        const config = document.createElement('td');
        config.textContent = configName;
        const runtimeArgsEl = document.createElement('td');
        runtimeArgsEl.textContent = runtimeArgs;
        const run = document.createElement('td');
        const runBtn = document.createElement('button');
        runBtn.textContent = 'Run';
        runBtn.onclick = () => {
            runEnvironment(runBtn, featureName, configName, runtimeArgs);
        };
        run.appendChild(runBtn);
        const deleteEl = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            deleteFavorite(featureName, configName, runtimeArgs);
        };
        deleteEl.appendChild(deleteBtn);

        tr.appendChild(feature);
        tr.appendChild(config);
        tr.appendChild(runtimeArgsEl);
        tr.appendChild(run);
        tr.appendChild(deleteEl);
        content.appendChild(tr);
    });
}

function populateFeatureTable(features: string[]) {
    const featureTable = byId('feature-table-content');
    featureTable.innerHTML = '';
    features.sort().forEach((featureName) => {
        const tr = document.createElement('tr');
        tr.dataset.featureName = featureName;
        const btn = document.createElement('button');
        const configNameInput = document.createElement('input');
        configNameInput.placeholder = 'Config name';
        configNameInput.setAttribute('list', 'config-name-list');
        configNameInput.value = getSavedConfigName(featureName);
        configNameInput.onchange = () => {
            saveConfigName(featureName, configNameInput.value);
        };

        const runtimeArgsInput = document.createElement('input');
        runtimeArgsInput.placeholder = 'Runtime args';
        runtimeArgsInput.value = localStorage.getItem(featureName + ':runtimeArgs') ?? '';
        runtimeArgsInput.onchange = () => {
            localStorage.setItem(featureName + ':runtimeArgs', runtimeArgsInput.value);
        };

        btn.textContent = 'Run';
        btn.onclick = () => {
            runEnvironment(btn, featureName, configNameInput.value, runtimeArgsInput.value);
        };
        const name = document.createElement('td');
        name.textContent = featureName;
        const configName = document.createElement('td');
        configName.appendChild(configNameInput);

        const runtimeArgs = document.createElement('td');
        runtimeArgs.appendChild(runtimeArgsInput);

        const run = document.createElement('td');
        run.appendChild(btn);

        tr.appendChild(name);
        tr.appendChild(configName);
        tr.appendChild(runtimeArgs);
        tr.appendChild(run);

        featureTable.appendChild(tr);
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
