import reactRendererFeature, { MainEnv } from './react-renderer.feature.js';
import React from 'react';
import { createRoot } from 'react-dom/client';

reactRendererFeature.setup(MainEnv, ({}) => {
    const div = document.createElement('div');
    div.setAttribute('id', 'container');
    document.body.appendChild(div);

    return {
        renderingService: {
            render: (Comp: any) => {
                createRoot(div).render(<Comp />);
            },
        },
    };
});
