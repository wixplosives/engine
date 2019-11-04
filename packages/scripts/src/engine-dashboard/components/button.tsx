import React from 'react';
import { isServerResponseMessage, ServerResponse } from '../../server-types';
import { classes, style } from './styles.st.css';

export interface ButtonProps {
    featureName?: string;
    configName?: string;
    runtimeOptions?: Array<{ key: string; value: string }>;
    isNodeEnvActive: boolean;
    onClick: (response: ServerResponse) => void;
}

export const ServerEnvironmentToggle: React.FunctionComponent<ButtonProps> = ({
    isNodeEnvActive,
    featureName,
    configName,
    onClick,
    runtimeOptions = []
}) => {
    const changeNodeEnvironmentState = async () =>
        await (await fetch(`node-env`, {
            method: isNodeEnvActive ? 'DELETE' : 'PUT',
            body: JSON.stringify({
                featureName,
                configName,
                runtimeOptions: runtimeOptions.reduce(
                    (acc, curr) => {
                        acc[curr.key] = curr.value;
                        return acc;
                    },
                    {} as Record<string, string>
                )
            }),
            headers: {
                'Content-type': 'application/json'
            }
        })).json();

    const onToggleChange = async () => {
        const response = await changeNodeEnvironmentState();
        if (isServerResponseMessage(response)) {
            onClick(response);
        } else {
            throw new Error(`Unexpected response from server: ${response}`);
        }
    };

    return (
        <div className={style(classes.toggle, { toggled: isNodeEnvActive })} onClick={onToggleChange}>
            <div className={style(classes.toggleBtn, { toggled: isNodeEnvActive })}></div>
        </div>
    );
};
