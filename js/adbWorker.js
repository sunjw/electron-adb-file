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
    'init': onInit,
    'getDevices': onGetDevices,
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

function onInit() {
    postMessage({
        messageId: 'init',
        ok: true,
    });
}

function onGetDevices() {
    adbHelper.getDevices((adbDevicesResult) => {
        postMessage({
            messageId: 'getDevices',
            ok: adbDevicesResult.code == 0,
            code: adbDevicesResult.code,
            err: adbDevicesResult.err,
            devices: adbDevicesResult.devices,
        });
    });
}
