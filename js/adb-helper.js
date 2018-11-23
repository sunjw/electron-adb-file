const Utils = require('./utils.js');
const ChildProcessHelper = require('./child_process-helper.js');

const MODE_PERMISSION_DENIED = 'Permission denied';

function fixAdbShellPath(path) {
    return path.replace(new RegExp(' ', 'g'), '\\ ');
}

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

class ADBHelper {
    constructor(adbPath) {
        this.adbPath = adbPath;
        this.curDevice = '';
        this.curDir = '';
        this.pullProcessList = {};

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
        //Utils.log('setCurDir=[' + this.curDir + ']');
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

        const fixedAdbShellPath = fixAdbShellPath(this.curDir);
        var cmd = new ChildProcessHelper.ChildProcessHelper(this.adbPath, ['shell', 'ls', '-al', fixedAdbShellPath]);
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
            //Utils.log('cmdOutput=[' + cmdOutput + ']');

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
                    file.mode = MODE_PERMISSION_DENIED;
                    file.size = 0;
                    file.modified = '';
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
                var lineNamePart = line;
                for (var i = 0; i < 7; ++i) {
                    var detailPart = details[i];
                    lineNamePart = lineNamePart.substr(lineNamePart.indexOf(detailPart) + detailPart.length);
                }
                file.name = lineNamePart.trim();
                if (isFileLink(file)) {
                    file.name = file.name.split('->')[0].trim();
                }

                if (file.name == '.' || file.name == '..') {
                    continue;
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

    pullFile(filePath, destPath, onPullProgressCallback, onPullFinishedCallback) {
        const pullRandId = Utils.getRandomInt(1000);
        var cmd = new ChildProcessHelper.ChildProcessHelper(this.adbPath, ['pull', filePath, destPath]);
        var pullProcessList = this.pullProcessList;
        pullProcessList[pullRandId] = cmd;

        cmd.run((child, data) => {
            // On process output...
            var progressOutput = data.toString();
            //Utils.log(progressOutput);
            var progressPercent = '';
            var progressLines = progressOutput.split('\n');
            var lineCount = progressLines.length;
            for (var i = lineCount; i > 0; --i) {
                var line = progressLines[i - 1];
                var prefix = line.substr(0, 6);
                if (prefix.startsWith('[') && prefix.endsWith(']')) {
                    // Found
                    Utils.log('pullFile, progress line=[' + line + ']');
                    progressPercent = prefix.substr(1, 4);
                    progressPercent = progressPercent.trim();
                    break;
                }
            }
            if (progressPercent != '') {
                onPullProgressCallback(progressPercent);
            }
        }, (child, exitCode, err) => {
            // On process finished
            delete pullProcessList[pullRandId];

            var adbPullResult = {};
            adbPullResult.code = 0;
            adbPullResult.err = '';

            if (err != 0) {
                adbPullResult.code = exitCode;
                adbPullResult.err = 'Pull [' + filePath + '] failed';
                onPullFinishedCallback(adbPullResult);
                return;
            }

            if (exitCode != 0) {
                adbPullResult.code = -1;
                adbPullResult.err = err.message;
                onPullFinishedCallback(adbPullResult);
                return;
            }

            onPullFinishedCallback(adbPullResult);
        });

        return pullRandId;
    }

    stopPullFile(pullId) {
        if (pullId in this.pullProcessList) {
            var pullCmd = this.pullProcessList[pullId];
            pullCmd.stop();
        }
    }

    stopAllPullFile() {
        for (const pullId of Object.keys(this.pullProcessList)) {
            var pullCmd = this.pullProcessList[pullId];
            pullCmd.stop();
        }
    }

}

// exports
exports.isFileDir = isFileDir;
exports.isFileLink = isFileLink;
exports.isPermissionDenied = isPermissionDenied;
exports.ADBHelper = ADBHelper;
