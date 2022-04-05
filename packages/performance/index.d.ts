type measurement = {
    duration: number;
    entryType: string;
    name: string;
    startTime: number;
    toJSON: () => {
        name: string;
        startTime: number;
        duration: number;
        entryType: string;
    };
};
declare const crossPerformance: {
    mark(markName: string): void;
    measure(measureName: string, startMark?: string, endMark?: string): measurement;
    getEntriesByType(type: string): PerformanceMeasure[];
    clearMarks(name?: string): void;
    clearMeasures(name?: string): void;
};

export = crossPerformance;
