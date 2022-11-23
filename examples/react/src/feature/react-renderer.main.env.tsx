import reactRendererFeature, { MainEnv } from './react-renderer.feature';
import React from 'react';
import ReactDOM from 'react-dom/client';

reactRendererFeature.setup(MainEnv, ({}) => {
    const div = document.createElement('div');
    div.setAttribute('id', 'container');
    document.body.appendChild(div);

    return {
        renderingService: {
            render: (Comp: any) => {
                ReactDOM.createRoot(div).render(<Comp />);
            },
        },
    };
});
