import React from 'react';

export const App = ({ features, currentFeature }: { features: Array<string>; currentFeature: string }) => {
    return (
        <div
            style={{
                display: 'flex',
                height: '100vh',
                width: '100vw',
            }}
        >
            <aside style={{ overflow: 'auto' }}>
                <ul>
                    {' '}
                    <h2>Detected features</h2>
                    {features.map((feature: string) => (
                        <li key={feature}>
                            <a href={`/?feature-name=${feature}`}>{feature}</a>/
                        </li>
                    ))}
                </ul>
            </aside>

            <main style={{ flex: '1' }}>
                <h2>{currentFeature ? `Selected feature is ${currentFeature}` : 'No feature selected'}</h2>
                {currentFeature && (
                    <iframe src={`/renderer?feature-name=${currentFeature}`} width="100%" height="100%"></iframe>
                )}
            </main>
        </div>
    );
};
