import React, { memo } from 'react';
import { classes, style } from './toggle.st.css';

export interface IToggleProps {
    toggled: boolean;
    onChange: (toggled: boolean) => void;
}

export const Toggle = memo<IToggleProps>(({ toggled, onChange }) => {
    const onToggleChange = () => onChange(!toggled);
    return (
        <div className={style(classes.root, { toggled: toggled })} onClick={onToggleChange}>
            <div className={style(classes.switch, { toggled: toggled })}></div>
        </div>
    );
});

Toggle.displayName = 'Toggle';
