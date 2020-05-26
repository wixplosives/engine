declare const crossPerformance: {
    mark(markName: string): void;
    measure(measureName: string, startMark?: string, endMark?: string): void;
    getEntriesByType(type: string): PerformanceMeasure[];
    clearMarks(name?: string): void;
    clearMeasures(name?: string): void;
};

export = crossPerformance;
