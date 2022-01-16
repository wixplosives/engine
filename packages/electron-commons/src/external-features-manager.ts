import type { IExternalFeatureNodeDescriptor } from '@wixc3/engine-runtime-node';
const defaultMapper = (externlFeature: IExternalFeatureNodeDescriptor) => {
    return externlFeature;
};

export class ExternalFeaturesManager {
    private externalFeatures = new Map<string, IExternalFeatureNodeDescriptor>();
    private entryMapper: (
        externlFeature: IExternalFeatureNodeDescriptor
    ) => IExternalFeatureNodeDescriptor | Promise<IExternalFeatureNodeDescriptor> = defaultMapper;
    public add(...externlFeatures: IExternalFeatureNodeDescriptor[]): void {
        for (const feature of externlFeatures) {
            if (this.externalFeatures.has(feature.scopedName)) {
                throw new Error(`a feature with the name ${feature.scopedName} is already defined as external`);
            }
            this.externalFeatures.set(feature.scopedName, feature);
        }
    }

    public setEntryMapper(
        entryMapper: (
            externlFeature: IExternalFeatureNodeDescriptor
        ) => IExternalFeatureNodeDescriptor | Promise<IExternalFeatureNodeDescriptor>
    ): void {
        this.entryMapper = entryMapper;
    }

    public remove(...externlFeatures: IExternalFeatureNodeDescriptor[]): void {
        for (const feature of externlFeatures) {
            this.externalFeatures.delete(feature.scopedName);
        }
    }

    public getMapped(): (IExternalFeatureNodeDescriptor | Promise<IExternalFeatureNodeDescriptor>)[] {
        return [...this.externalFeatures.values()].map((feature) => this.entryMapper(feature));
    }

    public clear(): void {
        this.externalFeatures.clear();
    }
}
