---
sidebar_position: 2
---

# Slots

Features can declare slots — which are integration points for other features of the application.
The reason behind this is separation of concerns.

Lets imaging a text editor with a top bar, which currently has in its right corner 3 buttons:

- copy (will copy selected content)
- paste (will paste from clipboard at the current cursor location)
- save (saves file)

Now, let's say we want to create a new button, which shows the git history for that file.

Traditionally, what you need to do is to create the git history component, which will probably be some icon with an
onClick event, implement the logic of the action, and add this component to the array of components currently displaying
the previous three items.

What slots allow is to say that the array of the icons is an integration point, and every feature can register with its
own items.
In this case, the top-bar component will render all the icons provided to it either by itself or other features.
We will create a `GitHistory` feature, which will be responsible for all the logic of the action, and will register this
action to the slot of the top bar.

A basic example of the mentioned above will look something like this:

```ts title=browser.environment.ts
export const browserEnv = new Environment('browser', 'window', 'single');
```

```ts title=types.ts
interface IActionOptions {
    filePath: string;
    cursorLocation: [lineNumber: number, colNumber: number];
}

export interface TopBarItem {
    IconComponent: React.Component;
    action: (actionOptions: IActionOptions) => void;
}
```

```ts title=gui.feature.ts
import type {TopBarItem} from "./types.ts"
import {browserEnv} from "./browser.environment.ts"

export default class GUIFeature extends Feature<'gui'> {
    id: 'gui' as const;
    api: {
        topBarItems: Slot.withType<TopBarItem>().defineEntity(browserEnv),
    }
}
```

```tsx title=gui.browser.env.ts
guiFeature.setup(browserEnv, ({topBarItems, run}) => {
    const getTopBarItems = () => {
        const topBarComponents = [];
        for (const {IconComponent, action} of topBarItems) {
            topBarComponents.push(
                <div onClick={action}>
                    <IconComponent/>
                </div>,
            );
        }
    };

    // let's assume there exists method `render(...)`,for rendering the ui of the application, so it will also render the top-bar component inside it 
    // the top-bar component will call this method, to render all icons inside
    render({getTopBarItems});
});
```

```ts
// git feature partial declaration
const gitHistoryFeature = new Feature({
  id: 'git',
  api: {},
  dependencies: [guiFeature],
});
```

```tsx
// git feature partial setup in browserEnv
gitHistoryFeature.setup(browserEnv, (_, { gui: { topBarItems } }) => {
  topBarItems.register({
    IconComponent,
    action: () => {
      // implementation
    },
  });
});
```

This allows us to separate concerns.
The `guiFeature` will forever be responsible for the application UI, and the `gitHistory` feature will be responsible
for that specific integration.
