import { createMultipleComponentSimulations } from "@wixc3/simulation-core";
import { FeaturesSelection } from "../../packages/scripts/src/engine-dashboard/components/features-selection";
import { features } from './features';

export default createMultipleComponentSimulations([{
        name: "New Simulation",
        readOnly: false,
        props: {
        features: {
            value: features
        }
    },
        environmentProps: {
        canvasWidth: 561,
        canvasHeight: 340
    },
        componentType: FeaturesSelection
    }]);
