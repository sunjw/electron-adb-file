const ADBHelper = require('./adbHelper.js');
const Utils = require('./utils.js');

const fixPath = require('fix-path').default;
//Utils.log('PATH=[' + process.env.PATH + ']');
fixPath(); // fix-path is important for packed electron app
//Utils.log('PATH=[' + process.env.PATH + ']');

// The helper is created when the client sends the init message, because
// the adb path comes from there.
let adbHelper = null;

// Every ADBHelper method the renderer calls has a message of its own.
// The handler names follow the method names.
const messageHandlerMap = {
    'init': onInit,
    'getDevices': onGetDevices,
    'getDirList': onGetDirList,
    'transfer': onTransfer,
    'stopTransfer': onStopTransfer,
};

onmessage = function (e) {
    let messageData = e.data;
    Utils.log('adbWorker.onmessage, messageId=[%s], reqId=[%s]',
        messageData.messageId, messageData.reqId);
    let messageHandler = messageHandlerMap[messageData.messageId];
    if (!messageHandler) {
        Utils.log('adbWorker.onmessage, unknown messageId=[%s]', messageData.messageId);
        return;
    }
    messageHandler(messageData);
};

// Every reply carries the request id of the message it answers, so the
// client can pair it with the callback that is waiting for it.
function reply(messageData, result) {
    result.messageId = messageData.messageId;
    result.reqId = messageData.reqId;
    postMessage(result);
}

function onInit(messageData) {
    adbHelper = new ADBHelper.ADBHelper(messageData.adbPath);
    reply(messageData, {
        ok: true,
    });
}

function onGetDevices(messageData) {
    adbHelper.getDevices((adbDevicesResult) => {
        reply(messageData, {
            ok: adbDevicesResult.code == 0,
            code: adbDevicesResult.code,
            err: adbDevicesResult.err,
            devices: adbDevicesResult.devices,
        });
    });
}

function onGetDirList(messageData) {
    // The device and the directory come with the message. The helper keeps
    // them as member variables too, but that is only a fallback for the
    // calls that have not been moved yet.
    adbHelper.getDirList(messageData.curDevice, messageData.curDir, (adbDirListResult) => {
        reply(messageData, {
            ok: adbDirListResult.code == 0,
            code: adbDirListResult.code,
            err: adbDirListResult.err,
            dirList: adbDirListResult.dirList,
        });
    });
}

// A transfer is not answered with one message but with a stream: a
// progress message for every step and one finished message at the end.
// These messages carry the transfer id instead of the request id, so the
// client can tell them apart from the replies.
function onTransfer(messageData) {
    adbHelper.transferFile(
        messageData.mode,
        messageData.filePath,
        messageData.destPath,
        messageData.curDevice,
        messageData.transferId,
        (progressPercent, progressText) => {
            postMessage({
                messageId: 'progress',
                transferId: messageData.transferId,
                percent: progressPercent,
                text: progressText,
            });
        },
        (adbTransferResult) => {
            postMessage({
                messageId: 'transferFinished',
                transferId: messageData.transferId,
                code: adbTransferResult.code,
                err: adbTransferResult.err,
                message: adbTransferResult.message,
            });
        });
    // The transfer is running now. It reports on its own, so this
    // message is only the acknowledgement that it was taken.
    reply(messageData, {
        ok: true,
    });
}

function onStopTransfer(messageData) {
    adbHelper.stopTransferFile(messageData.transferId);
    reply(messageData, {
        ok: true,
    });
}
