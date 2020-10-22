import React, { useCallback, memo } from 'react';
import { TitledElement } from '../../titled-element/titled-element';
import { classes, style } from './runtime-option.st.css';

type InputChangeEvent = (event: React.ChangeEvent<HTMLInputElement>) => void;

export interface IRuntimeOptionProps {
    index: number;
    runtimeArguments: Array<{ key: string; value: string }>;
    onChange: (runtimeArgiments: Array<{ key: string; value: string }>) => unknown;
    className: string;
}

export const RuntimeOption = memo<IRuntimeOptionProps>(({ runtimeArguments, index, onChange, className }) => {
    const { key, value } = runtimeArguments[index];

    const onValueChange = useCallback<(key: string) => InputChangeEvent>(
        (key: string) => ({ target: { value: runtimeValue } }) => {
            runtimeArguments.splice(index, 1, { ...runtimeArguments[index], [key]: runtimeValue });
            onChange([...runtimeArguments]);
        },
        [runtimeArguments, index, onChange]
    );
    return (
        <div className={style(classes.root, className)}>
            <TitledElement title={'Key'} className={classes.option}>
                <input className={classes.input} type="string" value={key} onChange={onValueChange('key')} />
            </TitledElement>
            <TitledElement title={'Value'} className={classes.option}>
                <input className={classes.input} type="string" value={value} onChange={onValueChange('value')} />
            </TitledElement>
        </div>
    );
});

RuntimeOption.displayName = 'RuntimeOption';
