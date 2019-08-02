import React from 'react';
import { isServerResponseMessage, ServerResponse } from '../../server-types';

export interface ButtonProps {
    featureName: boolean;
    configName: boolean;
    isServerActive: boolean;
    onClick: (response: ServerResponse) => void;
}

export const ServerEnvironmentButton: React.FunctionComponent<ButtonProps> = ({
    isServerActive,
    featureName,
    configName,
    onClick
}) => {
    const changeServerState = async () =>
        await (await fetch(`node-env?featureName=${featureName}&configName=${configName}`, {
            method: isServerActive ? 'DELETE' : 'PUT'
        })).json();

    const onButtonClick = async () => {
        const response = await changeServerState();
        if (isServerResponseMessage(response)) {
            onClick(response);
        } else {
            throw new Error(`Unexpected response from server: ${response}`);
        }
    };

    const buttonText = `${!isServerActive ? 'Start' : 'Close'} server environment(s)`;
    return <button onClick={onButtonClick}>{buttonText}</button>;
};
