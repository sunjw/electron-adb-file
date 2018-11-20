const Utils = require('./utils.js');
const ChildProcessHelper = require('./child_process-helper.js');

class ADBHelper {
    constructor(adbPath) {
        this.adbPath = adbPath;

        //Utils.log('adb=[' + this.adbPath + ']');
    }

    getDevices(onDevicesCallback) {
        var cmd = new ChildProcessHelper.ChildProcessHelper(this.adbPath, ['devices']);
        var outChunks = [];

        cmd.run((child, data) => {
            // On process output...
            outChunks.push(data.toString());
        }, (child, exitCode) => {
            // On process finished
            var cmdOutput = outChunks.join('');
            //Utils.log('cmdOutput=[' + cmdOutput + ']');

            var adbDevices = [];
            var foundHeader = false;
            var lines = cmdOutput.split('\n');
            for (var line of lines) {
                line = line.trim();
                if (line == '') {
                    continue;
                }
                if (line == 'List of devices attached') {
                    foundHeader = true;
                    continue;
                }
                if (foundHeader) {
                    var[id, status] = line.split('\t');
                    var device = {};
                    device.id = id;
                    device.status = status;
                    adbDevices.push(device);
                }
            }

            onDevicesCallback(adbDevices);
        });
    }
}

// exports
exports.ADBHelper = ADBHelper;
