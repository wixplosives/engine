globalThis.envMessages = [...(globalThis.envMessages ?? []), 'parentPreload'];

export const init = () => {
    globalThis.envMessages = [...(globalThis.envMessages ?? []), 'parentPreloadInit'];
};
