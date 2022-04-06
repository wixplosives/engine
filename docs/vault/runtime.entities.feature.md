---
id: 5jom0ayqorrbn2pqdn1xhyp
title: Feature
desc: ''
updated: 1649235395316
created: 1646817042514
---

`Feature` constructor accepts 3 options

### `id: string`

Unique identifier, This is the feature name. For example a `file-server` feature will be initiated as `const fileServerFeature = new Feature({id: 'file-server', ...rest})` and the rest of the folder structure should be prefixed with `file-server`.

![Feature file structure](assets/images/feature_folder_example.png){max-width: 300px}

### `Dependencies: []`

Features that this current feature is dependant upon
### `api: Api`

Api implements 3 types of interfaces:
#### Config

#### Slot

![[runtime.entities.slot#^slots-pitch]]

#### Service

Service is a method within an API. When we need to declare API methods we will call the `Service.withType` static.

```typescript
const myFeature = new Feature({
  id: 'myFeature',
  api: {
    echoService: Service.withType< echo(): string>().defineEntity(env1)
  },
  // etc..
})
```
