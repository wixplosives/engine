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
    populateDatalistOptions(configs, 'config-name-list');
    populateFeatureTable(features);
    setupSearch();
}

function setupSearch() {
    const input = byId('feature-search') as HTMLInputElement;
    input.value = localStorage.getItem('feature-search') ?? '';
    const onInput = () => {
        const search = input.value;
        localStorage.setItem('feature-search', search);
        const searchReg = new RegExp(search.replace(/(\w)/g, `$1.*?`), 'i');
        const featureTable = byId('feature-table').querySelectorAll('tr[data-feature-name]');
        for (const tr of Array.from(featureTable) as Array<HTMLTableRowElement>) {
            const featureName = String(tr.dataset.featureName);
            tr.style.display = featureName.match(searchReg) ? '' : 'none';
        }
    };
    input.oninput = onInput;
    onInput();
}

function populateFeatureTable(features: string[]) {
    const featureTable = byId('feature-table');
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
            btn.disabled = true;
            fetch('/api/engine/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    featureName,
                    configName: configNameInput.value,
                }),
            })
                .then((response) => response.json())
                .then((data) => {
                    console.log(data);
                    window.open(data.url, '_blank');
                })
                .catch(uiError)
                .finally(() => {
                    btn.disabled = false;
                });
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

function populateDatalistOptions(options: string[], id: string) {
    const dataList = byId(id);
    dataList.id = id;
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
