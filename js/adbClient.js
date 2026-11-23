const Utils = require('./utils.js');

class ADBClient {
    constructor(adbPath) {
        this.adbPath = adbPath;
        // The id of the next request, and the callbacks waiting for the
        // replies. A reply carries the request id, so the right callback
        // is found even when several requests are in flight.
        this.reqId = 0;
        this.callbackMap = {};

        this.worker = new Worker('js/adbWorker.js');
        this.worker.onmessage = (e) => {
            let messageData = e.data;
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
    }

    // Send a message to the worker and wait for its reply.
    sendMessage(messageId, options, callback) {
        this.reqId = this.reqId + 1;
        let reqId = this.reqId;
        this.callbackMap[reqId] = callback;
        this.worker.postMessage(Object.assign({
            messageId: messageId,
            reqId: reqId,
        }, options));
        return reqId;
    }

    getDevices(onDevicesCallback) {
        return this.sendMessage('getDevices', {}, (messageData) => {
            onDevicesCallback({
                code: messageData.code,
                err: messageData.err,
                devices: messageData.devices,
            });
        });
    }
}

// exports
exports.ADBClient = ADBClient;
