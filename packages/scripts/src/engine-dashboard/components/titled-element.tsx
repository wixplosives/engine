import React from 'react';
import {classes } from './styles.st.css'

export interface IInputProps {
    title?: string
}

export const TitledElement: React.FC<IInputProps> = ({title, children}) => {
    return <div className={classes['input-container']}>
        <div className={classes['input-title']}>
            {title}
        </div>
        {children}
    </div>
} 