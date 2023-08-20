# Services

Service is an entity defined in the feature's API, and it represents an 'output' of the feature.

Each [feature](index.md) defines integration points and services, which other features will be able to use.

A service is defined by the feature, **for an environment**, meaning that the implementation to that service should
return from the setup function of that feature in that environment.

so a service declaration in a feature would look something like

```ts
interface IEchoService {
  echo(): string
}

const f1 = new Feature({
  id: 'f1',
  api: {
    echoService: Service.withType<IEchoService>().providedFrom(myEnv);
  }
});
```

In the feature's setup function, in the `myEnv` environment, We will need to provide an implementation for the
declared `echoService`;

```ts
f1.setup(myEnv, () => {
  const echoService = {
    echo: () => {
      return 'hello from f1';
    },
  };

  return {
    echoService,
  };
});
```

After `f1` declared this service other features in `myEnv` can access the service.

First let's craete a new feature with a dependency on `f1`

```ts
const f2 = new Feature({
  id: 'f2',
  api: {},
  dependencies: [f1],
});
```

This will allow f2, when running in `myEnv`, to access the services of `f1`.

```ts
f2.setup(myEnv, (_, { f1: { echoService } }) => {
  console.log(echoService.echo());
});
```

## Remote service

Now let's say we have 2 environments, `myEnv` and `otherEnv`.
`f1` wants the echoService to be available also in `otherEnv`.
Let's tweak the declaration of `f1`

```ts
interface IEchoService {
  echo(): string
}

const f1 = new Feature({
  id: 'f1',
  api: {
    echoService: Service.withType<IEchoService>().providedFrom(myEnv).allowRemoteAccess();
  }
});
```

This will allow `f1` (or any other feature) to access the `echoService` provided from `myEnv`.

Because `echoService` is provided from the feature currently being setup, it will be accessible from the first argument
of the [[runtime.entities.feature#^setup_handler]]

```ts
f1.setup(otherEnv, ({ echoService }) => {
  // because the service is provided from myEnv, the service will ba async in this environment
  echoService
    .echo()
    .then((echoData) => {
      console.log('received', echoData);
    })
    .catch(console.error);
});
```

If any other feature which has a direct dependency on `f1` wants to access that service from any other environment that
is not `myEnv`, the usage will be the same as [[runtime.entities.service#^dependency_setup]] but, again, all the
services would be async.

### .allowRemoteAccess(options)

The `allowRemoteAccess` is the only method exposed from the service instance, and it notifies the engine, that for any
other environment we should proxy this api call to the environment where the service is provided from.

The `options` object structure is as follows:

- every key of the object is a method name on the service
- the value is an object with the following optional arguments

| argument           | type                                                       | explanation                                                                       |
|--------------------|------------------------------------------------------------|-----------------------------------------------------------------------------------|
| emitOnly           | boolean                                                    | tells the communication that a response for a call to this method is not required |
| listener           | boolean                                                    | whether this method is a registration to an event emitter method                  |
| removeListener     | string (the name of the 'listener' method in this service) | the method which removes a listener provided to 'listener' method                 |
| removeAllListeners | string (the name of the 'listener' method in this service) | the method which removes all the listeners provided to the 'listener' method      |

- currently we support only methods which provide only a callback method as a valid subscriber when subscribing to
  events across environments
