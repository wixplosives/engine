import React from 'react';
import { TitledElement } from './titled-element';
import { classes } from './styles.st.css'

export interface IRuntimeOptionProps {
    index: number;
    runtimeArguments: Array<{ key: string; value: string }>;
    onChange: (runtimeArgiments: Array<{ key: string; value: string }>) => unknown;
}

export const RuntimeOption: React.FC<IRuntimeOptionProps> = ({ runtimeArguments, index, onChange }) => {
    const { key, value } = runtimeArguments[index];
    return (
        <div className={classes['run-options-container']}>
            <TitledElement title={'key'}>
                <input
                    type="string"
                    value={key}
                    onChange={({ target: { value: keyValue } }) => {
                        runtimeArguments.splice(index, 1, { ...runtimeArguments[index], key: keyValue });
                        onChange([...runtimeArguments]);
                    }}
                />
            </TitledElement>
            <TitledElement title={'value'}>
                <input
                    type="string"
                    value={value}
                    onChange={({ target: { value: runtimeValue } }) => {
                        runtimeArguments.splice(index, 1, { ...runtimeArguments[index], value: runtimeValue });
                        onChange([...runtimeArguments]);
                    }}
                />
            </TitledElement>
        </div>
    );
};
