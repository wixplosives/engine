import React from 'react';
import { isServerResponseMessage, ServerResponse } from '../../server-types';

export interface ButtonProps {
    featureName: string;
    configName: string;
    isNodeEnvActive: boolean;
    onClick: (response: ServerResponse) => void;
}

export const ServerEnvironmentButton: React.FunctionComponent<ButtonProps> = ({
    isNodeEnvActive,
    featureName,
    configName,
    onClick
}) => {
    const changeNodeEnvitonmrtState = async () =>
        await (await fetch(`node-env?featureName=${featureName}&configName=${configName}`, {
            method: isNodeEnvActive ? 'DELETE' : 'PUT'
        })).json();

    const onButtonClick = async () => {
        const response = await changeNodeEnvitonmrtState();
        if (isServerResponseMessage(response)) {
            onClick(response);
        } else {
            throw new Error(`Unexpected response from server: ${response}`);
        }
    };

    const action = isNodeEnvActive ? 'Close': 'Start';
    return <button onClick={onButtonClick}>{action} server environment(s)</button>;
};
