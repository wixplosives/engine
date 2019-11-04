import React from 'react';
import { render } from 'react-dom';
import { App } from './components/app';

const reactContainer = document.createElement('div');
document.body.appendChild(reactContainer);

render(<App />, reactContainer);
