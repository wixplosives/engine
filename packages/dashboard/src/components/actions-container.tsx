import React, { memo } from 'react';
import { Toggle } from './toggle.js';
import { classes } from './actions-container.st.css';

export interface IActionsContainerProps {
    displayServerToggle: boolean;
    isServerActive: boolean;
    onToggleChange: (toggleStatus: boolean) => void;
    featureName?: string;
    configName?: string;
    actionBtnClassName?: string;
}

export const ActionsContainer = memo<IActionsContainerProps>(function ActionsContainer({
    displayServerToggle,
    isServerActive,
    onToggleChange,
    featureName,
    configName,
    actionBtnClassName,
}) {
    return (
        <div className={classes.actionsContainer}>
            {displayServerToggle ? (
                <div className={classes.serverState}>
                    <span>Server status</span>
                    <span>
                        <Toggle toggled={isServerActive} onChange={onToggleChange} />
                    </span>
                </div>
            ) : null}

            {featureName ? (
                <a
                    href={`main.html?feature=${featureName}&config=${configName!}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={actionBtnClassName}
                >
                    Go to page
                </a>
            ) : null}
        </div>
    );
});
