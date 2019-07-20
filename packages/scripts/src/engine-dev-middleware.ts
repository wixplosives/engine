import { Router } from 'express';
import { EngineEnvironmentEntry, EvaluatedFeature, LinkInfo, SymbolList } from './types';

export function engineDevMiddleware(
    features: EvaluatedFeature[],
    environments: EngineEnvironmentEntry[],
    linksInfo: LinkInfo[]
) {
    const router = Router();

    router.get('/', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(renderDevHTMLPage(features, environments, linksInfo));
    });

    return router;
}

function renderFeatureMappingLinks(links: LinkInfo[]) {
    return (
        `<div><span class="header-title">Example feature</span><span class="header-title">config</span></div>` +
        links
            .map(
                linkInfo => `
      <div>
        <a href="${linkInfo.url}" class="link">
          <span class="link-content">${linkInfo.feature}</span>${
                    linkInfo.config ? `<span class="link-content">${linkInfo.config}</span>` : ''
                }
        </a>
      </div>
    `
            )
            .join('<br>')
    );
}

export function renderDevHTMLPage(
    features: EvaluatedFeature[],
    environments: EngineEnvironmentEntry[],
    linkInfo: LinkInfo[]
) {
    return HTMLWrapper(
        'Engine Dashboard',
        `
    ${defaultStyle()}
  <h1>Running Engine<h1>
  <h2>Web Environment</h2>
  <h3>
    Engine links:
  </h3>
  <div>
    ${renderFeatureMappingLinks(linkInfo)}
  </div>
  <div class="web-environments">
  ${environments
      .filter(({ target }) => target === 'web')
      .map(
          envEntry =>
              `<div>${envEntry.name}</div>
        ${toggleContent(envEntry.name, 'Entry Source', `<pre>${JSON.stringify(envEntry.featureMapping)}</pre>`)}`
      )
      .join('\n')}
    <h2>Workers</h2>
    ${environments
        .filter(({ target }) => target === 'webworker')
        .map(
            envEntry =>
                `<div>${envEntry.name}</div>${toggleContent(
                    envEntry.name,
                    'Entry Source',
                    `<pre>${JSON.stringify(envEntry.featureMapping)}</pre>`
                )}`
        )
        .join('\n')}
  <div>
  <h2>Features</h2>
  ${features.map(fe => renderStaticFeatureEntitiesPreview(fe as any)).join('\n')}
  `
    );
}

export function renderStaticFeatureEntitiesPreview(e: EvaluatedFeature) {
    return `<div class="feature-entities">
      <h2>${e.filePath}</h2>
      ${renderSymbols('Environments', e.environments)}
    </div>`;
}

function renderSymbols(name: string, items: SymbolList<any>) {
    return items.length
        ? `<div>
      <h3>${name}</h3>
      <ul>
        ${items.map(item => `<li>${item.name}</li>`).join('')}
      </ul>
    </div>`
        : '';
}

function toggleContent(id: string, header: string, content: string) {
    return `<div class="wrap-collabsible">
  <input id="${id}" class="toggle" type="checkbox">
  <label for="${id}" class="lbl-toggle">${header}</label>
  <div class="collapsible-content">
    <div class="content-inner">
      ${content}
    </div>
  </div>
</div>`;
}

function HTMLWrapper(title: string, body: string) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>${title}</title>
</head>
<body>
  ${body}
</body>
</html>
`;
}

function defaultStyle() {
    return `
<style>
  .feature-entities {
    background: rgba(0, 0, 0, 0.02);
    margin: 0 0.5rem;
    padding: 1rem;
    border: 1px solid rgba(0, 0, 0, 0.08);
  }
  .web-environments a {
    display: block;
    padding: 0.5rem;
    background: rgba(0,0,0,0.02);
  }

  .wrap-collabsible {
    margin-bottom: 1.2rem 0;
  }

  input[type='checkbox'] {
    display: none;
  }

  .lbl-toggle {
    display: block;

    font-weight: bold;
    font-family: monospace;
    font-size: 1.2rem;
    text-transform: uppercase;
    text-align: center;

    padding: 1rem;

    color: rgba(0,0,0,0.7);
    background: rgba(0,0,0,0.04);

    cursor: pointer;
    transition: all 0.25s ease-out;
  }

  .lbl-toggle:hover {
    color: rgba(0,0,0,0.9);
  }

  .lbl-toggle::before {
    content: ' ';
    display: inline-block;

    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 5px solid currentColor;
    vertical-align: middle;
    margin-right: .7rem;
    transform: translateY(-2px);

    transition: transform .2s ease-out;
  }

  .toggle:checked + .lbl-toggle::before {
    transform: rotate(90deg) translateX(-3px);
  }

  .collapsible-content {
    max-height: 0px;
    overflow: hidden;
    transition: max-height .25s ease-in-out;
  }

  .toggle:checked + .lbl-toggle + .collapsible-content {
    max-height: 350px;
  }

  .toggle:checked + .lbl-toggle {
  }

  .collapsible-content .content-inner {
    background: rgba(0, 0, 0, .1);
    border-bottom: 1px solid rgba(0, 0, 0, .35);
    padding: .5rem 1rem;
  }
  .link-content{
    display: inline-block;
    min-width: 300px;
    border-right: 1px solid gray;
    margin-right: 20px;
    padding: 5px;
  }
  .header-title{
    display: inline-block;
    min-width: 300px;
    border-right: 1px solid gray;
    margin-right: 20px;
    padding: 5px;
    font-weight: 700;
  }
  .link{
    display: block;
    background: lightblue;
  }
  .link:hover{
    background: #67e5ec;
  }
</style>
`;
}
