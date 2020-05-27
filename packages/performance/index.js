const measures = new Map();
const initialStartTime = Date.now();
const initMarkName = `__init__${Math.random().toString(16).slice(2)}`;
const initMark = {
    duration: 0,
    entryType: 'mark',
    name: initMarkName,
    startTime: initialStartTime,
    toJSON: () => ({ name: initMarkName, initialStartTime }),
};
const marks = new Map();

function getMarkTime({ defaultMark, markName }) {
    // getting latest mark for the given markName (if given one)
    const { startTime } = markName
        ? marks.get(markName)
            ? marks.get(markName).slice(-1)[0]
            : defaultMark
        : defaultMark;
    return startTime;
}

function toJSON() {
    return {
        name: this.name,
        startTime: this.startTime,
        duration: this.duration,
        entryType: this.type
    };
}

module.exports = {
    mark: (markName) => {
        const mark = marks.get(markName);
        const startTime = Date.now() - initMark.startTime;

        const currentMeasure = {
            duration: 0,
            entryType: 'mark',
            name: markName,
            startTime,
            toJSON,
        };
        if (!mark) {
            marks.set(markName, [currentMeasure]);
        } else {
            mark.push(currentMeasure);
        }
    },
    measure: (measureName, startMark, endMark) => {
        const currentTime = { startTime: Date.now() };
        const startTime = getMarkTime({
            markName: startMark,
            defaultMark: initMark,
        });

        const endTime = getMarkTime({
            markName: endMark,
            defaultMark: currentTime,
        });

        const measure = measures.get(measureName);
        const measurement = {
            duration: endTime - startTime,
            startTime,
            entryType: 'measure',
            name: measureName,
            toJSON,
        };
        if (!measure) {
            measures.set(measureName, [measurement]);
        } else {
            measure.push(measurement);
        }
    },
    getEntriesByType: (type) => {
        switch (type) {
            case 'mark':
                return [].concat(...[...marks.values()]);
            case 'measure':
                return [].concat(...[...measures.values()]);
            default:
                return [];
        }
    },
    clearMarks: (name) => {
        if (name) {
            marks.delete(name);
        } else {
            marks.clear();
        }
    },
    clearMeasures: (name) => {
        if (name) {
            measures.delete(name);
        } else {
            measures.clear();
        }
    },
};
