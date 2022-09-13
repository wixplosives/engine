import React, { createContext } from 'react';
import { classes } from './runtime-options-container.st.css';
import { RuntimeOption } from './runtime-option';


// export const RuntimeOptionsContainer = React.memo<RuntimeOptionsContainerProps>(function RuntimeOptionsContainer({
//     onOptionAdded,
//     runtimeOptions,
//     setRuntimeArguments,
//     actionBtnClassName,
// }) {
//     return (
//         <div className={classes.root}>
//             <div className={classes.title}>Server runtime options</div>
//             <div className={classes.options}>
//                 {runtimeOptions.map((_, index) => (
//                     <RuntimeOption
//                         key={index}
//                         index={index}
//                         runtimeArguments={runtimeOptions}
//                         onChange={setRuntimeArguments}
//                         className={classes.option}
//                     ></RuntimeOption>
//                 ))}
//             </div>
//             <button className={actionBtnClassName} onClick={onOptionAdded}>
//                 +
//             </button>
//         </div>
//     );
// });
