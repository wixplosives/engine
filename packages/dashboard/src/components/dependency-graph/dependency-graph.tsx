import React, { FC, useCallback, useContext, useEffect, useState } from 'react';
import type { GraphData } from '../../graph-types';
import { DashboardContext } from '../dashboard';
import { FeatureGraph } from '../feature-graph';

interface IDependencyGraphProps {
    fetchGraphData: (featureName: string) => Promise<GraphData>;
}

const DependencyGraph: FC<IDependencyGraphProps> = ({ fetchGraphData }) => {
    const [showGraph, setShowGraph] = useState(false);
    const [selectedFeatureGraph, setSelectedFeatureGraph] = useState<GraphData | null>(null);

    const { selectedFeature, params } = useContext(DashboardContext);

    const selectedFeatureConfig = useCallback(
        async (featureName: string) => {
            const graphData = await fetchGraphData(featureName);
            setSelectedFeatureGraph(graphData);
        },
        [fetchGraphData]
    );

    useEffect(() => {
        if (selectedFeature) selectedFeatureConfig(selectedFeature).catch(console.warn);
    }, [selectedFeature, selectedFeatureConfig]);

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

export default DependencyGraph;
