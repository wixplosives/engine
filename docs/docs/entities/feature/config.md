# Configs

Each [feature](/entities/feature.md) can declare that it can be configured using the `Config` entity.
we can import the `Config` entity and use in the the feature declaration

```ts
export default new Feature({
  id: 'myFeature',
  api: {
    someConfig: new Config<{ mandatoryKey: string; optionalKey?: string }>({ mandatoryKey: 'value' }),
  },
});
```

The `Config` entity defined the interface of the config and requires a default value.

In the setup phase of the feature, in any environment, we now can access the config as follows:

```ts
f.setup(env, ({ someConfig }) => {
  console.log(someConfig);
});
```

If no other config is provided, the following code will output

```
{ mandatoryKey: 'value' }
```
