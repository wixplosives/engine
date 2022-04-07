---
id: vwijkf6kssesvezejnjzw36
title: Environment
desc: ''
updated: 1649319652915
created: 1646817074058
---

When creating a new [[runtime.entities.feature]], You will keep in mind on which "environment" this feature will be setup upon. 

For example, a file-server feature which should provide Node `readDir` and `readFile` can run on two (or more) different environments: `node` or `window`, Then we will define them as follows:

```typescript
/**
 * defining that this feature uses 2 environments - 'main' (browser) and LiveServer environment with the semantic name 'server'
 */
export const main = new Environment('main', 'window', 'single');
export const server = new Environment('server', 'node', 'single');
```

If the feature API requires a specific entity which natively provides this functionality we will use the `.defineEntity(<entity_name>)`

```typescript
Service.withType<FileSystemAPI>().defineEntity(server).allowRemoteAccess()
```