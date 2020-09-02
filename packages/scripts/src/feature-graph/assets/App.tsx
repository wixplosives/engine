import React from 'react';
import { features } from 'process';

export const App = ({ features }: { features: Array<string> }) => {
    return (
        <div
            style={{
                display: 'flex',
                height: '100vh',
                width: '100vw',
            }}
        >
            <aside>
                {features.map((feature: string) => (
                    <li key={feature}>
                        <a href={`/react?feature-name=${feature}`}>{feature}</a>/
                    </li>
                ))}
            </aside>
            <main style={{ flex: '1' }}>
                <iframe src="renderer.html" width="100%" height="100%"></iframe>
            </main>
        </div>
    );
};
