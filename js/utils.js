function log(logString) {
    console.log(logString);
}

function cloneObject(obj) {
    var clone = {};
    for (var i in obj) {
        if (obj[i] != null && typeof(obj[i]) == "object")
            clone[i] = cloneObject(obj[i]);
        else
            clone[i] = obj[i];
    }
    return clone;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
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
exports.cloneObject = cloneObject;
exports.getRandomInt = getRandomInt;
exports.byteSizeToShortSize = byteSizeToShortSize;
