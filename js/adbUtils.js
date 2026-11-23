const MODE_PERMISSION_DENIED = 'Permission denied';

function isFileDir(file) {
    if (file.mode.startsWith('d')) {
        return true;
    }
    if (isFileLink(file) && file.linkMode == 'd') {
        return true;
    }
    return false;
}

function isFileLink(file) {
    return file.mode.startsWith('l');
}

function isPermissionDenied(file) {
    return (file.mode == MODE_PERMISSION_DENIED);
}

// exports
exports.MODE_PERMISSION_DENIED = MODE_PERMISSION_DENIED;
exports.isFileDir = isFileDir;
exports.isFileLink = isFileLink;
exports.isPermissionDenied = isPermissionDenied;
