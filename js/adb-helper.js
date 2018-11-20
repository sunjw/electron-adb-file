const Utils = require('./utils.js');
const ChildProcessHelper = require('./child_process-helper.js');

class ADBHelper {
    constructor(adbPath) {
        this.adbPath = adbPath;

        Utils.log('adb=[' + this.adbPath + ']');
    }

    getDevices() {

    }
}

// exports
exports.ADBHelper = ADBHelper;
