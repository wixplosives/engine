import React, { useMemo, useCallback } from 'react';
import type { ServerFeatureDef } from '../server-types';
import { classes, st } from './feature-selection.st.css';
import { TitledElement } from './titled-element';

import { AutoComplete } from 'stylable-components/dist/auto-complete/auto-complete';
import { SearchableText } from 'stylable-components/dist/searchable-text/searchable-text';
import type { ListItemProps } from 'stylable-components/dist/list/list';
import { Root } from '@zeejs/react';

export interface FeaturesSelectionProps {
    features: Record<string, ServerFeatureDef>;
    selectedFeature?: string;
    selectedConfig?: string;
    onSelected?: (featureName?: string, configName?: string) => unknown;
}

const TextItemRenderer = ({ data, isFocused, isSelected, id }: ListItemProps<string>) => {
    return (
        <div
            data-id={id}
            className={st(classes.autocompleteItem, {
                focused: isFocused,
                selected: isSelected,
            })}
        >
            <SearchableText text={data} />
        </div>
    );
};
const identity = function <T>(t: T): T {
    return t;
};

export const FeaturesSelection = React.memo<FeaturesSelectionProps>(
    ({ features, onSelected, selectedConfig, selectedFeature }) => {
        const featureNames = useMemo(() => Object.keys(features), [features]);
        const configNames = useMemo(
            () => features[selectedFeature!]?.configurations ?? [],
            [features, selectedFeature]
        );

        const onConfigChange = useCallback(
            (newConfigName?: string) => {
                onSelected?.(selectedFeature, newConfigName);
            },
            [onSelected, selectedFeature]
        );

        const onFeatureChange = useCallback(
            (newFeatureName?: string) => {
                if (!newFeatureName) {
                    return;
                }
                const newConfigName = features[newFeatureName]?.configurations[0];
                onSelected?.(newFeatureName, newConfigName);
            },
            [features, onSelected]
        );
        return (
            <div className={classes.root}>
                <TitledElement title={'Feature'} className={classes.option}>
                    <AutoComplete
                        items={featureNames}
                        ItemRenderer={TextItemRenderer}
                        getId={identity}
                        getTextContent={identity}
                        selectionControl={[selectedFeature, onFeatureChange]}
                    />
                </TitledElement>
                <TitledElement title={'Config'} className={classes.option}>
                    <AutoComplete
                        items={configNames}
                        ItemRenderer={TextItemRenderer}
                        getId={identity}
                        getTextContent={identity}
                        selectionControl={[selectedConfig, onConfigChange]}
                    />
                </TitledElement>
            </div>
        );
    }
);

FeaturesSelection.displayName = 'FeaturesSelection';
