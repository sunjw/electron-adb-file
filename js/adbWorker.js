const ADBHelper = require('./adbHelper.js');
const Utils = require('./utils.js');

const fixPath = require('fix-path').default;
//Utils.log('PATH=[' + process.env.PATH + ']');
fixPath(); // fix-path is important for packed electron app
//Utils.log('PATH=[' + process.env.PATH + ']');

const adbPath = 'adb';
const adbHelper = new ADBHelper.ADBHelper(adbPath);

// Every ADBHelper method the renderer calls has a message of its own.
// The handler names follow the method names.
const messageHandlerMap = {
    'getDevices': onGetDevices,
    'getDirList': onGetDirList,
};

onmessage = function (e) {
    let messageData = e.data;
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
    adbHelper.getDirList(messageData.curDevice, messageData.curDir, (adbDirListResult) => {
        reply(messageData, {
            ok: adbDirListResult.code == 0,
            code: adbDirListResult.code,
            err: adbDirListResult.err,
            dirList: adbDirListResult.dirList,
        });
    });
}
