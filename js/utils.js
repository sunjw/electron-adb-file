function log(logString) {
    console.log(logString);
}

function byteSizeToShortSize(size) {
    const shortSizeUnit = ['K', 'M', 'G'];
    var shortSize = size;
    for (var i = 0; i < shortSizeUnit.length; ++i) {
        if (size >= 1024) {
            shortSize = (size / 1024.0).toFixed(2) + shortSizeUnit[i];
            size = size / 1024;
        } else {
            break;
        }
    }
    return shortSize;
}

// exports
exports.log = log;
exports.byteSizeToShortSize = byteSizeToShortSize;
