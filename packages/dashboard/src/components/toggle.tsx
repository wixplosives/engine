import React from 'react';
import { classes, style } from './toggle.st.css';

export interface ToggleProps {
    toggled: boolean;
    onChange: (toggled: boolean) => void;
}

export const Toggle = React.memo<ToggleProps>(function Toggle({ toggled, onChange }) {
    const onToggleChange = () => onChange(!toggled);
    return (
        <div className={style(classes.root, { toggled })} onClick={onToggleChange}>
            <div className={style(classes.switch, { toggled })}></div>
        </div>
    );
});
