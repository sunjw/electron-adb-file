const Utils = require('./utils.js');
const ChildProcessHelper = require('./child_process-helper.js');

const CMD_DELIMITER = '/';
const CMD_SELECT_DEVICE = 'select-device';

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

        // Check
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
                if (line == '' || line.startsWith('total ')) {
                    continue;
                }

                var file = {};

                if (line.startsWith('ls: ')) {
                    if (!line.endsWith('Permission denied')) {
                        continue;
                    }

                    // Permission denied, but actually, there is a something
                    var permDetails = line.split(/\s+/);
                    if (permDetails.length < 3) {
                        Utils.log('Format error: [' + line + ']');
                        continue;
                    }
                    var fileName = permDetails[1];
                    if (fileName.endsWith(':')) {
                        fileName = fileName.substr(0, fileName.length - 1);
                    }
                    var pathDelimIdx = fileName.lastIndexOf('/');
                    if (pathDelimIdx >= 0) {
                        fileName = fileName.substr(pathDelimIdx + 1);
                    }
                    file.mode = 'Permission denied';
                    file.name = fileName;
                    adbDirListResult.dirList.push(file);
                    continue;
                }

                var details = line.split(/\s+/);
                if (details.length < 7) {
                    Utils.log('Format error: [' + line + ']');
                    continue;
                }
                file.mode = details[0];
                file.linkMode = 0;
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

            // Fix link
            for (var file of adbDirListResult.dirList) {
                if (!isFileLink(file)) {
                    continue;
                }

                //Utils.log('[' + file.name + '] is a link');
                var tryPath = this.curDir + file.name + '/';
                // Run some sync child_process in async callback
                var cmdSync = new ChildProcessHelper.ChildProcessHelper(this.adbPath, ['shell', 'cd', tryPath]);
                var cmdResult = cmdSync.runSync();
                if (cmdResult.stdout.length == 0 && cmdResult.stderr.length == 0) {
                    // We 'cd' this path succeed
                    file.linkMode = 'd';
                } else {
                    file.linkMode = 'f';
                }
                //Utils.log('[' + file.name + '] is a link, but it is a \'' + file.linkMode + '\'');
            }

            onDirListCallback(adbDirListResult);
        });
    }

    setCurDir(path) {
        // Path must end with '/'
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
exports.isFileLink = isFileLink;
exports.ADBHelper = ADBHelper;
