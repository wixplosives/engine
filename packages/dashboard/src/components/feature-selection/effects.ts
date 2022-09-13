import { useEffect } from "react";
import type { ServerState } from "../../server/common";
import type { Selection, Setter } from "../dashboard-ctx";

export function useOnCtxSelectionChanged(selected: { feature: string; fixture: string; config: string; },
    setFeature: Setter,
    setFixture: Setter,
    setConfig: Setter) {
    useEffect(() => {
        const { fixture, feature, config } = selected;
        setFeature(feature);
        setFixture(fixture);
        setConfig(config);
    }, [selected]);
}

export function useOnUserSelection(features: ServerState['features'], feature: string, fixture: string, config: string,
    setSelected: Setter<Selection>,
    setFixture: Setter,
    setConfig: Setter) {
    useEffect(() => {
        if (features[feature]) {
            setSelected({
                feature, fixture, config
            });
        } else {
            setFixture('');
            setConfig('');
        }
    }, [feature, fixture, config, features]);
}

