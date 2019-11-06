import React, { memo } from 'react';
import { classes, style } from './titled-element.st.css';

export interface IInputProps {
    className: string;
    title?: string;
}

export const TitledElement: React.FC<IInputProps> = memo(({ title, className, children }) => {
    return (
        <div className={style(classes.root, className)}>
            <div className={classes.title}>{title}</div>
            {children}
        </div>
    );
});
