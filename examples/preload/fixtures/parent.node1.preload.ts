globalThis.envMessages = [...(globalThis.envMessages ?? []), 'node', 'parentPreload'];

export const init = () => {
    globalThis.envMessages = [...(globalThis.envMessages ?? []), 'node', 'parentPreloadInit'];
};
