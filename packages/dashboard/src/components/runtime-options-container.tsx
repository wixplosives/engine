import React from 'react';
import { RuntimeOption } from './runtime-option.js';
import { classes } from './runtime-options-container.st.css';

export interface IRuntimeOption {
    key: string;
    value: string;
}

export interface RuntimeOptionsContainerProps {
    onOptionAdded: () => void;
    runtimeOptions: IRuntimeOption[];
    setRuntimeArguments: (options: IRuntimeOption[]) => void;
    actionBtnClassName?: string;
}

export const RuntimeOptionsContainer = React.memo<RuntimeOptionsContainerProps>(function RuntimeOptionsContainer({
    onOptionAdded,
    runtimeOptions,
    setRuntimeArguments,
    actionBtnClassName,
}) {
    return (
        <div className={classes.root}>
            <div className={classes.title}>Server runtime options</div>
            <div className={classes.options}>
                {runtimeOptions.map((_, index) => (
                    <RuntimeOption
                        key={index}
                        index={index}
                        runtimeArguments={runtimeOptions}
                        onChange={setRuntimeArguments}
                        className={classes.option}
                    ></RuntimeOption>
                ))}
            </div>
            <button className={actionBtnClassName} onClick={onOptionAdded}>
                +
            </button>
        </div>
    );
});
