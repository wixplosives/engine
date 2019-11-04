import React from 'react';
import { classes } from './styles.st.css';

export interface IInputProps {
    title?: string;
}

export const TitledElement: React.FC<IInputProps> = ({ title, children }) => {
    return (
        <div className={classes.columnedContainer}>
            <div className={classes.inputTitle}>{title}</div>
            {children}
        </div>
    );
};
