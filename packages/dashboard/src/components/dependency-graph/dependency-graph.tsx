import React, { FC, useContext, useEffect, useState } from 'react';
import type { SerializedGraphData } from '../../graph-types';
import { DashboardCtx } from '../dashboard-ctx';
import { FeatureGraph } from '../feature-graph';
import { data as sampleData } from './sample-graph';

interface IDependencyGraphProps {
    fetchGraphData: (featureName: string) => Promise<SerializedGraphData>;
}

export const DependencyGraph: FC<IDependencyGraphProps> = ({ fetchGraphData }) => {
    const [showGraph, setShowGraph] = useState(false);
    const [selectedFeatureGraph, setSelectedFeatureGraph] = useState<SerializedGraphData | null>(null);

    const { selected, graphData } = useContext(DashboardCtx);

    useEffect(() => {
        const applyFeatureGraphData = async (featureName = '') => {
            const graphData = await fetchGraphData(featureName);
            setSelectedFeatureGraph(graphData);
        };

        if (params.user_feature) applyFeatureGraphData(params.user_feature).catch(console.warn);
    }, [fetchGraphData, params.user_feature]);

    return (
        <>
            <div>
                <input
                    id="feature-graph"
                    type="checkbox"
                    checked={showGraph}
                    onChange={(e) => setShowGraph(e.currentTarget.checked)}
                />
                <label htmlFor="feature-graph">Feature Dependency Graph</label>
            </div>
            {showGraph &&
                (params.user_feature ? (
                    selectedFeatureGraph ? (
                        <FeatureGraph selectedFeatureGraph={selectedFeatureGraph} />
                    ) : (
                        <div>Loading graph data...</div>
                    )
                ) : (
                    <div>Select a feature to view its dependency graph</div>
                ))}
        </>
    );
};
