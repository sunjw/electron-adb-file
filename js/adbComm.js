const MODE_PERMISSION_DENIED = 'Permission denied';

// The ids of the messages that the renderer and the worker exchange.
// They live here so that a rename cannot miss one of the places that
// use it: the client sends them, the worker routes them by them.

// Requests, from the renderer to the worker.
const MESSAGE_INIT = 'init';
const MESSAGE_GET_DEVICES = 'getDevices';
const MESSAGE_GET_DIR_LIST = 'getDirList';
const MESSAGE_START_TRANSFER = 'startTransfer';
const MESSAGE_STOP_TRANSFER = 'stopTransfer';

// Messages that the worker sends on its own. They are not answers to a
// request, so they carry the transfer id instead of the request id.
const MESSAGE_TRANSFER_PROGRESS = 'transferProgress';
const MESSAGE_TRANSFER_FINISHED = 'transferFinished';

// The messages that belong to a transfer. The client routes them by the
// transfer id, everything else by the request id.
const TRANSFER_MESSAGE_IDS = [
    MESSAGE_TRANSFER_PROGRESS,
    MESSAGE_TRANSFER_FINISHED,
];

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
exports.MESSAGE_INIT = MESSAGE_INIT;
exports.MESSAGE_GET_DEVICES = MESSAGE_GET_DEVICES;
exports.MESSAGE_GET_DIR_LIST = MESSAGE_GET_DIR_LIST;
exports.MESSAGE_START_TRANSFER = MESSAGE_START_TRANSFER;
exports.MESSAGE_STOP_TRANSFER = MESSAGE_STOP_TRANSFER;
exports.MESSAGE_TRANSFER_PROGRESS = MESSAGE_TRANSFER_PROGRESS;
exports.MESSAGE_TRANSFER_FINISHED = MESSAGE_TRANSFER_FINISHED;
exports.TRANSFER_MESSAGE_IDS = TRANSFER_MESSAGE_IDS;
exports.isFileDir = isFileDir;
exports.isFileLink = isFileLink;
exports.isPermissionDenied = isPermissionDenied;
