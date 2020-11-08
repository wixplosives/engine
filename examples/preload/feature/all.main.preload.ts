if (globalThis.envMessages) {
    globalThis.envMessages.push('error: something loaded before preload');
} else {
    globalThis.envMessages = ['main', 'preload'];
}
