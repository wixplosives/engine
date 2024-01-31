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

function populateOpenEnvs(openManagers: { featureName: string; configName: string; port: number; url: string }[]) {
    const content = byId('open-environments-content');
    content.innerHTML = '';
    openManagers.forEach(({ featureName, configName, url }) => {
        const tr = document.createElement('tr');
        const feature = document.createElement('td');
        feature.textContent = featureName;
        const config = document.createElement('td');
        config.textContent = configName;
        const urlEl = document.createElement('td');
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.textContent = url;
        const restart = document.createElement('td');
        const restartBtn = document.createElement('button');
        restartBtn.textContent = 'Restart';
        restartBtn.onclick = () => {
            runEnvironment(restartBtn, featureName, configName);
        };
        restart.appendChild(restartBtn);
        urlEl.appendChild(link);
        tr.appendChild(feature);
        tr.appendChild(config);
        tr.appendChild(urlEl);
        tr.appendChild(restart);
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
        configNameInput.setAttribute('list', 'config-name-list');
        configNameInput.value = getSavedConfigName(featureName);
        configNameInput.onchange = () => {
            saveConfigName(featureName, configNameInput.value);
        };

        btn.textContent = 'Run';
        btn.onclick = () => {
            runEnvironment(btn, featureName, configNameInput.value);
        };
        const name = document.createElement('td');
        name.textContent = featureName;
        const configName = document.createElement('td');
        configName.appendChild(configNameInput);
        const run = document.createElement('td');
        run.appendChild(btn);

        tr.appendChild(name);
        tr.appendChild(configName);
        tr.appendChild(run);

        featureTable.appendChild(tr);
    });
}

function runEnvironment(btn: HTMLButtonElement, featureName: string, configName: string) {
    btn.disabled = true;
    fetch('/api/engine/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            featureName,
            configName,
        }),
    })
        .then((response) => response.json())
        .then((data) => {
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
