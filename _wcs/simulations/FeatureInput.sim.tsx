import { createMultipleComponentSimulations } from "@wixc3/simulation-core";
import { FeatureInput } from "../../packages/scripts/src/engine-dashboard/components/feature-inputs";

export default createMultipleComponentSimulations([{
        name: "title",
        readOnly: false,
        props: {
        title: {
            value: "dd"
        }
    },
        environmentProps: {},
        componentType: FeatureInput
    }]);
