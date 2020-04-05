import React, { useMemo, memo } from 'react';
import { classes } from './runtime-options-container.st.css';
import { RuntimeOption } from './runtime-option/runtime-option';

export interface IRuntimeOption {
    key: string;
    value: string;
}

export interface IRuntimeOptionsProps {
    onOptionAdded: () => void;
    runtimeOptions: IRuntimeOption[];
    setRuntimeArguments: (options: IRuntimeOption[]) => void;
    actionBtnClassName: string;
}

export const RuntimeOptionsContainer = memo<IRuntimeOptionsProps>(
    ({ onOptionAdded, runtimeOptions, setRuntimeArguments, actionBtnClassName }) => {
        const runtimeElements = useMemo(
            () =>
                runtimeOptions.map((_, index) => (
                    <RuntimeOption
                        key={index}
                        index={index}
                        runtimeArguments={runtimeOptions}
                        onChange={setRuntimeArguments}
                        className={classes.option}
                    ></RuntimeOption>
                )),
            [runtimeOptions, setRuntimeArguments]
        );
        return (
            <div className={classes.root}>
                <div className={classes.title}>Server runtime options</div>
                <div className={classes.options}>{runtimeElements}</div>
                <button className={actionBtnClassName} onClick={onOptionAdded}>
                    +
                </button>
            </div>
        );
    }
);

RuntimeOptionsContainer.displayName = 'RuntimeOptionsContainer';
