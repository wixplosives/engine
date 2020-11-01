import { MAIN } from '@fixture/3rd-party/3rd-party.feature';
import MyFeature from './app.feature';

MyFeature.setup(MAIN, ({ run, myConfig, mySlot }) => {
    const pre = document.createElement('pre');
    const slotValues = [...mySlot];
    pre.innerText = JSON.stringify(slotValues);
    document.body.appendChild(pre);
    mySlot.subscribe((item) => {
        slotValues.push(item);
        pre.innerText = JSON.stringify(slotValues);
    });
    run(() => {
        document.body.innerHTML += `
          <h1>App is running</h1>
          <h2>myConfig</h2>
          <pre id="myConfig">${JSON.stringify(myConfig)}</pre>
          <h2>mySlot</h2>
        `;
    });
});
