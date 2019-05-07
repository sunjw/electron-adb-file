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

function stringReplaceAll(string, target, replace) {
    return string.replace(new RegExp(target, 'g'), replace);
}

function escapeShellPath(path) {
    const needEscape = [' ', '&', '*', '$', '?', '|', '"', '\'',
        ';', '<', '>', '#', '(', ')'];
    var pathEscape = path;
    for (var escape of needEscape) {
        var escapeReg = escape;
        if (escapeReg == '*' || escapeReg == '$' ||
            escapeReg == '?' || escapeReg == '|' ||
            escapeReg == '(' || escapeReg == ')') {
            escapeReg = '\\' + escapeReg;
        }
        pathEscape = stringReplaceAll(pathEscape, escapeReg, '\\' + escape);
    }
    return pathEscape;
}

function escapeHtmlPath(path) {
    var pathEscape = path;
    pathEscape = stringReplaceAll(pathEscape, '&', '&amp;');
    pathEscape = stringReplaceAll(pathEscape, '<', '&lt;');
    pathEscape = stringReplaceAll(pathEscape, '>', '&gt;');
    pathEscape = stringReplaceAll(pathEscape, ' ', '&nbsp;');
    return pathEscape;
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

function getParentDir(path) {
    var curPath = path;
    if (curPath.endsWith('/')) {
        curPath = curPath.substr(0, curPath.length - 1);
    }
    var pathDelimIdx = curPath.lastIndexOf('/');
    var parentDirPath = curPath.substr(0, pathDelimIdx);
    parentDirPath = parentDirPath + '/';
    return parentDirPath;
}

function isWindows() {
    return (process.platform == 'win32');
}

// exports
exports.log = log;
exports.cloneObject = cloneObject;
exports.stringReplaceAll = stringReplaceAll;
exports.escapeShellPath = escapeShellPath;
exports.escapeHtmlPath = escapeHtmlPath;
exports.getRandomInt = getRandomInt;
exports.byteSizeToShortSize = byteSizeToShortSize;
exports.getParentDir = getParentDir;
exports.isWindows = isWindows;
