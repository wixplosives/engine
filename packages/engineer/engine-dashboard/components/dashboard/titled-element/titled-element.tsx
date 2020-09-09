import React, { memo } from 'react';
import { classes, style } from './titled-element.st.css';

export interface IInputProps {
    className: string;
    title?: string;
    children: React.ReactNode;
}

export const TitledElement = memo<IInputProps>(({ title, className, children }) => {
    return (
        <div className={style(classes.root, className)}>
            <div className={classes.title}>{title}</div>
            {children}
        </div>
    );
});

TitledElement.displayName = 'TitledElement';
