import React from 'react';
import { classes, style } from './titled-element.st.css';

export interface TitledElementProps {
    className?: string;
    title?: string;
    children: React.ReactNode;
}

export const TitledElement = React.memo<TitledElementProps>(function TitledElement({ title, className, children }) {
    return (
        <div className={style(classes.root, className)}>
            <div className={classes.title}>{title}</div>
            {children}
        </div>
    );
});
