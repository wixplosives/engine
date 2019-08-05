import React from 'react';
import { render } from 'react-dom';
import { Dashboard } from './components/dashboard';

const reactContainer = document.createElement('div');
document.body.appendChild(reactContainer);

render(<Dashboard />, reactContainer);
