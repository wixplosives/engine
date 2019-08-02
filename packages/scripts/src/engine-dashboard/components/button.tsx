import React from 'react';
import { isServerResponseMessage, ServerResponse } from '../../server-types';

export interface ButtonProps {
    featureName: string;
    configName: string;
    isServerActive: boolean;
    onClick: (response: ServerResponse, featureName: string, configName: string) => void;
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
            onClick(response, featureName, configName);
        } else {
            throw new Error(`Unexpected response from server: ${response}`);
        }
    };

    const buttonText = `${!isServerActive ? 'Start' : 'Close'} server environment(s)`;
    return <button onClick={onButtonClick}>{buttonText}</button>;
};
