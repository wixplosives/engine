# Documentation (guides)

This website is built using [Docusaurus 3](https://docusaurus.io/), a modern static website generator.

## Local Development

Because of issues with quality of Docusaurus dependency management, we use it dynamically, so in GitHub action
for publishing and without committing `package.json` into repository. You should rename `.package.json` to `package.json`
before starting local development.

```
yarn workspace engine-guides start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without
having to restart the server.
