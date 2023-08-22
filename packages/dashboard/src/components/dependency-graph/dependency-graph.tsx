import React, { useContext, useEffect, useState, type FC } from 'react';
import type { GraphData } from '../../graph-types.js';
import { DashboardContext } from '../dashboard.js';
import { FeatureGraph } from '../feature-graph.js';

interface IDependencyGraphProps {
    fetchGraphData: (featureName: string) => Promise<GraphData>;
}

export const DependencyGraph: FC<IDependencyGraphProps> = ({ fetchGraphData }) => {
    const [showGraph, setShowGraph] = useState(false);
    const [selectedFeatureGraph, setSelectedFeatureGraph] = useState<GraphData | null>(null);

    const { params } = useContext(DashboardContext);

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
