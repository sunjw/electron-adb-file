const Utils = require('./utils.js');
const ChildProcessHelper = require('./child_process-helper.js');

const CMD_DELIMITER = '/';
const CMD_SELECT_DEVICE = 'select-device';

function isFileLink(file) {
    return file.mode.startsWith('l');
}

class ADBHelper {
    constructor(adbPath) {
        this.adbPath = adbPath;
        this.curDevice = '';
        this.curDir = '';

        //Utils.log('adb=[' + this.adbPath + ']');
    }

    getDevices(onDevicesCallback) {
        const headerString = 'List of devices attached';

        var adbDevicesResult = {};
        adbDevicesResult.code = 0;
        adbDevicesResult.err = '';
        adbDevicesResult.devices = [];

        var cmd = new ChildProcessHelper.ChildProcessHelper(this.adbPath, ['devices']);
        var outChunks = [];

        cmd.run((child, data) => {
            // On process output...
            outChunks.push(data.toString());
        }, (child, exitCode, err) => {
            // On process finished
            if (err != 0) {
                adbDevicesResult.code = exitCode;
                adbDevicesResult.err = err.message;
                onDevicesCallback(adbDevicesResult);
                return;
            }

            var cmdOutput = outChunks.join('');
            //Utils.log('cmdOutput=[' + cmdOutput + ']');

            var lines = cmdOutput.split('\n');
            // Check first
            if (lines[0] != headerString) {
                adbDevicesResult.code = -1;
                adbDevicesResult.err = cmdOutput;
                onDevicesCallback(adbDevicesResult);
                return;
            }

            for (var line of lines) {
                line = line.trim();
                if (line == '' || line == headerString) {
                    continue;
                }

                var[id, status] = line.split('\t');
                var device = {};
                device.id = id;
                device.status = status;
                adbDevicesResult.devices.push(device);
            }

            onDevicesCallback(adbDevicesResult);
        });
    }

    setCurDevice(device) {
        this.curDevice = device;
        Utils.log('setCurDevice=[' + this.curDevice + ']');
    }

    getDirList(onDirListCallback) {
        var adbDirListResult = {};
        adbDirListResult.code = 0;
        adbDirListResult.err = '';
        adbDirListResult.dirList = [];

        // check
        if (!this.curDir.endsWith('/')) {
            adbDirListResult.code = -1;
            adbDirListResult.err = 'Current directory error: [' + this.curDir + ']';
            onDirListCallback(adbDirListResult);
            return;
        }

        var cmd = new ChildProcessHelper.ChildProcessHelper(this.adbPath, ['shell', 'ls', '-al', this.curDir]);
        var outChunks = [];

        cmd.run((child, data) => {
            // On process output...
            outChunks.push(data.toString());
        }, (child, exitCode, err) => {
            // On process finished
            if (err != 0) {
                adbDirListResult.code = exitCode;
                adbDirListResult.err = err.message;
                onDirListCallback(adbDirListResult);
                return;
            }

            var cmdOutput = outChunks.join('');
            Utils.log('cmdOutput=[' + cmdOutput + ']');

            var lines = cmdOutput.split('\n');
            for (var line of lines) {
                line = line.trim();
                if (line == '' || line.startsWith('ls: ') || line.startsWith('total ')) {
                    continue;
                }

                var details = line.split(/\s+/);
                var file = {};
                file.mode = details[0];
                file.links = details[1];
                file.ownUser = details[2];
                file.ownGroup = details[3];
                file.size = details[4];
                file.modified = details[5] + ' ' + details[6];
                file.name = '';
                for (var i = 7; i < details.length; ++i) {
                    file.name = file.name + details[i] + ' ';
                }
                file.name = file.name.trim();
                if (isFileLink(file)) {
                    file.name = file.name.split('->')[0].trim();
                }
                adbDirListResult.dirList.push(file);
            }
        });
    }

    setCurDir(path) {
        // path must end with '/'
        if (!path.endsWith('/')) {
            Utils.log('setCurDir=[' + path + '], not end with \'/\'');
            return;
        }
        this.curDir = path;
        //Utils.log('setCurDir=[' + this.curDir + ']');
    }
}

// exports
exports.CMD_DELIMITER = CMD_DELIMITER;
exports.CMD_SELECT_DEVICE = CMD_SELECT_DEVICE;
exports.ADBHelper = ADBHelper;
