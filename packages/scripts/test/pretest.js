const fs = require('fs')
const originalWatch = fs.watch

const openWatchers = new Set()
exports.openWatchers = openWatchers

fs.watch = function(filePath, ...args) {
    const watcher = originalWatch(filePath, ...args)
    watcher.filePath = filePath
    openWatchers.add(watcher)
    watcher.once('close', () => openWatchers.delete(watcher))
    return watcher
}