const Utils = require('./utils.js');
const ADBComm = require('./adbComm.js');

class ADBClient {
    constructor(adbPath) {
        this.adbPath = adbPath;
        // The device and the directory the app is working with. They are
        // kept here and sent along with every request that needs them.
        this.curDevice = '';
        this.curDir = '';
        // The id of the next request, and the callbacks waiting for the
        // replies. A reply carries the request id, so the right callback
        // is found even when several requests are in flight.
        this.reqId = 0;
        this.callbackMap = {};
        // The transfers that are running, and the callbacks that belong
        // to them. A transfer is not a request: it answers with a
        // stream of progress messages and one final message, so it gets
        // a table of its own and is not deleted when a reply arrives.
        this.transferMap = {};

        this.worker = new Worker('js/adbWorker.js');
        this.worker.onmessage = (e) => {
            let messageData = e.data;
            let messageId = messageData.messageId;
            if (ADBComm.TRANSFER_MESSAGE_IDS.includes(messageId)) {
                // The messages of a transfer. They carry the transfer id
                // instead of the request id.
                // Utils.log('adbClient.onmessage, messageId=[%s], transferId=[%s]',
                //     messageId, messageData.transferId);
                this.onTransferMessage(messageData);
                return;
            }
            Utils.log('adbClient.onmessage, messageId=[%s], reqId=[%s], ok=%s',
                messageId, messageData.reqId, messageData.ok);
            let callback = this.callbackMap[messageData.reqId];
            if (!callback) {
                Utils.log('adbClient.onmessage, no callback for reqId=[%s]', messageData.reqId);
                return;
            }
            delete this.callbackMap[messageData.reqId];
            callback(messageData);
        };
        this.worker.onerror = (e) => {
            Utils.log('adbClient.worker.onerror, err=%s', e.message);
        };

        // The worker needs the adb path before it can do anything.
        this.sendMessage(ADBComm.MESSAGE_INIT, { adbPath: this.adbPath }, (messageData) => {});
    }

    // Send a message to the worker and wait for its reply.
    sendMessage(messageId, options, callback) {
        this.reqId = this.reqId + 1;
        let reqId = this.reqId;
        this.callbackMap[reqId] = callback;
        let message = Object.assign({
            messageId: messageId,
            reqId: reqId,
        }, options);
        // Utils.log('adbClient.sendMessage, messageId=[%s], reqId=[%s]', message.messageId, message.reqId);
        this.worker.postMessage(message);
        return reqId;
    }

    getCurDevice() {
        return this.curDevice;
    }

    setCurDevice(device) {
        this.curDevice = device;
        Utils.log('setCurDevice=[' + this.curDevice + ']');
    }

    getCurDir() {
        return this.curDir;
    }

    setCurDir(path) {
        // Path must end with '/'
        if (!path.endsWith('/')) {
            Utils.log('setCurDir=[' + path + '], not end with \'/\'');
            return;
        }
        this.curDir = path;
    }

    getDevices(onDevicesCallback) {
        return this.sendMessage(ADBComm.MESSAGE_GET_DEVICES, {}, (messageData) => {
            onDevicesCallback({
                code: messageData.code,
                err: messageData.err,
                devices: messageData.devices,
            });
        });
    }

    getDirList(onDirListCallback) {
        return this.sendMessage(ADBComm.MESSAGE_GET_DIR_LIST, {
            curDevice: this.curDevice,
            curDir: this.curDir,
        }, (messageData) => {
            onDirListCallback({
                code: messageData.code,
                err: messageData.err,
                dirList: messageData.dirList,
            });
        });
    }

    // Start a transfer. The transfer id comes from the caller, so that
    // the caller can build the stop link right away.
    //
    // The transfer is not a request that is answered once: it answers
    // with a stream of progress messages and one final message. The
    // callbacks are therefore kept in the transfer table until the
    // transfer is over.
    transfer(transferMode, filePath, destPath, transferId, onProgressCallback, onFinishedCallback) {
        this.transferMap[transferId] = {
            percent: 0,
            onProgress: onProgressCallback,
            onFinished: onFinishedCallback,
        };
        return this.sendMessage(ADBComm.MESSAGE_START_TRANSFER, {
            transferId: transferId,
            mode: transferMode,
            curDevice: this.curDevice,
            filePath: filePath,
            destPath: destPath,
        }, (messageData) => {
            // The reply only says that the transfer was taken. The
            // transfer reports on its own, with progress messages and a
            // finished message, so nothing is done here.
        });
    }

    // Stop a transfer that is running.
    stopTransfer(transferId) {
        return this.sendMessage(ADBComm.MESSAGE_STOP_TRANSFER, {
            transferId: transferId,
        }, (messageData) => {});
    }

    // Stop every transfer that is running.
    stopAllTransfer() {
        return this.sendMessage(ADBComm.MESSAGE_STOP_ALL_TRANSFER, {}, (messageData) => {});
    }

    // The number of transfers that are running.
    getTransferFileCount() {
        return Object.keys(this.transferMap).length;
    }

    // The progress of the transfer that is the least far along.
    getTransferFileMinProgress() {
        let minProgress = 100;
        for (const transferId of Object.keys(this.transferMap)) {
            let transferProgress = this.transferMap[transferId].percent;
            if (transferProgress < minProgress) {
                minProgress = transferProgress;
            }
        }

        return minProgress;
    }

    // A message of a running transfer: the progress or the end of it.
    onTransferMessage(messageData) {
        let transfer = this.transferMap[messageData.transferId];
        if (!transfer) {
            // The transfer is over already. A progress that arrives
            // after the end must not touch anything.
            Utils.log('adbClient.onTransferMessage, no transfer for transferId=[%s]',
                messageData.transferId);
            return;
        }
        if (messageData.messageId == ADBComm.MESSAGE_TRANSFER_PROGRESS) {
            transfer.percent = messageData.percent;
            transfer.onProgress(messageData.percent, messageData.text);
            return;
        }
        this.finishTransfer(messageData.transferId, messageData);
    }

    // The transfer is over, its callbacks are done.
    finishTransfer(transferId, messageData) {
        let transfer = this.transferMap[transferId];
        if (!transfer) {
            return;
        }
        delete this.transferMap[transferId];
        transfer.onFinished({
            code: messageData.code,
            err: messageData.err,
            message: messageData.message,
        });
    }
}

// exports
exports.ADBClient = ADBClient;
