const Fs = require('fs');
const Path = require('path');

const Adbkit = require('@devicefarmer/adbkit');
const Promise = require("bluebird");

const Utils = require('./utils.js');
const ChildProcessHelper = require('./child_process-helper.js');

const MODE_PERMISSION_DENIED = 'Permission denied';

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
        this.transferProcessList = {};

        this.adbkitClient = null;
        this.usingAdbkit = Utils.isWindows();
        if (this.usingAdbkit) {
            this.adbkitClient = Adbkit.Adb.createClient();
            Utils.log('using Adbkit...');
        }

        //Utils.log('adb=[' + this.adbPath + ']');
    }

    getDevices(onDevicesCallback) {
        const headerString = 'List of devices attached';
        const daemonString = 'daemon not running';

        let adbDevicesResult = {};
        adbDevicesResult.code = 0;
        adbDevicesResult.err = '';
        adbDevicesResult.devices = [];

        let cmd = new ChildProcessHelper.ChildProcessHelper(this.adbPath, ['devices']);
        let outChunks = [];

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

            let cmdOutput = outChunks.join('');
            //Utils.log('cmdOutput=[' + cmdOutput + ']');

            let lines = cmdOutput.split('\n');
            // Check first
            let firstLine = lines[0].trim();
            if (firstLine != headerString && firstLine.indexOf(daemonString) < 0) {
                adbDevicesResult.code = -1;
                adbDevicesResult.err = cmdOutput;
                onDevicesCallback(adbDevicesResult);
                return;
            }

            for (let line of lines) {
                line = line.trim();
                if (line == '' || line == headerString) {
                    continue;
                }

                let[id, status] = line.split('\t');
                if (status === undefined) {
                    continue;
                }
                let device = {};
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

    getCurDeviceCmdBase() {
        return ['-s', this.curDevice];
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
        let adbDirListResult = {};
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

        const fixedAdbShellPath = Utils.escapeShellPath(this.curDir);
        let cmdArgs = this.getCurDeviceCmdBase().concat(['shell', 'ls', '-al', fixedAdbShellPath]);
        let cmd = new ChildProcessHelper.ChildProcessHelper(this.adbPath, cmdArgs);
        let outChunks = [];

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

            let cmdOutput = outChunks.join('');
            //Utils.log('cmdOutput=[' + cmdOutput + ']');

            let lines = cmdOutput.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line == '' || line.startsWith('total ')) {
                    continue;
                }

                let file = {};

                if (line.startsWith('ls: ')) {
                    if (!line.endsWith('Permission denied')) {
                        continue;
                    }

                    // Permission denied, but actually, there is a something
                    let permDetails = line.split(/\s+/);
                    if (permDetails.length < 3) {
                        Utils.log('Format error: [' + line + ']');
                        continue;
                    }
                    let fileName = permDetails[1];
                    if (fileName.endsWith(':')) {
                        fileName = fileName.substr(0, fileName.length - 1);
                    }
                    let pathDelimIdx = fileName.lastIndexOf('/');
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

                let details = line.split(/\s+/);
                if (details.length < 7) {
                    Utils.log('Format error: [' + line + ']');
                    continue;
                }
                let fixAndroidR = false;
                file.mode = details[0];
                file.linkMode = 0;
                file.links = details[1];
                file.ownUser = details[2];
                file.ownGroup = details[3];
                file.size = details[4];
                if (details[5] == '?') {
                    fixAndroidR = true;
                }
                if (!fixAndroidR) {
                    file.modified = details[5] + ' ' + details[6];
                } else {
                    file.modified = details[5];
                }
                file.name = '';
                let lineNamePart = line;
                let partsBeforeName = fixAndroidR ? 6 : 7;
                for (let i = 0; i < partsBeforeName; ++i) {
                    let detailPart = details[i];
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
            for (let file of adbDirListResult.dirList) {
                if (!isFileLink(file)) {
                    continue;
                }

                //Utils.log('[' + file.name + '] is a link');
                let tryPath = this.curDir + file.name + '/';
                // Run some sync child_process in async callback
                let cmdArgs = this.getCurDeviceCmdBase().concat(['shell', 'cd', tryPath]);
                let cmdSync = new ChildProcessHelper.ChildProcessHelper(this.adbPath, cmdArgs);
                let cmdResult = cmdSync.runSync();
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

    nativeGetFileSize(filePath) {
        let fileSize = 0;
        const fixedAdbShellPath = Utils.escapeShellPath(filePath);
        let cmdArgs = this.getCurDeviceCmdBase().concat(['shell', 'stat', '-c', '%s', fixedAdbShellPath]);
        let cmdSync = new ChildProcessHelper.ChildProcessHelper(this.adbPath, cmdArgs);
        let cmdResult = cmdSync.runSync();
        let fileSizeStr = cmdResult.stdout.trim();
        fileSize = Number(fileSizeStr);
        if (isNaN(fileSize)) {
            fileSize = 0;
        }
        //Utils.log('nativeGetFileSize, [' + fileSizeStr + ']');
        return fileSize;
    }

    transferFile(transferMode, filePath, destPath, onProgressCallback, onFinishedCallback) {
        const transferRandId = Utils.getRandomInt(1000);
        let transferProcessList = this.transferProcessList;
        transferProcessList[transferRandId] = {};
        transferProcessList[transferRandId].mode = transferMode;
        transferProcessList[transferRandId].percent = 0;

        let onFinishedCallbackWrapper = function (adbTransferResult) {
            delete transferProcessList[transferRandId];
            onFinishedCallback(adbTransferResult);
        };

        if (!this.usingAdbkit) {
            let cmd = this.nativeTransferFile(transferProcessList[transferRandId],
                    filePath, destPath, onProgressCallback, onFinishedCallbackWrapper);
            transferProcessList[transferRandId].cmd = cmd;
        } else {
            this.adbkitTransferFile(transferProcessList[transferRandId],
                filePath, destPath, onProgressCallback, onFinishedCallbackWrapper);
        }

        return transferRandId;
    }

    nativeTransferFile(transferProcess, filePath, destPath, onProgressCallback, onFinishedCallback) {
        let transferCmd = '';
        switch (transferProcess.mode) {
        case 'pull':
            transferCmd = 'pull';
            break;
        case 'push':
            transferCmd = 'push';
            break;
        }
        let cmdArgs = this.getCurDeviceCmdBase().concat([transferCmd, filePath, destPath]);
        let cmd = new ChildProcessHelper.ChildProcessHelper(this.adbPath, cmdArgs);

        let runFunction = 'runUnbuffer';
        let cmdNewline = '[K';
        if (Utils.isWindows()) {
            // Windows PTY is broken...
            runFunction = 'run';
            cmdNewline = '\n';
        }

        if (transferProcess.mode == 'pull') {
            transferProcess.totalSize = this.nativeGetFileSize(filePath);
            transferProcess.startTime = Date.now();
            transferProcess.transferSpeed = '';
        }

        cmd[runFunction]((child, data) => {
            // On process output...
            let progressOutput = data.toString();
            //Utils.log(progressOutput);
            let progressPercent = '';
            let progressLines = progressOutput.split(cmdNewline);
            let lineCount = progressLines.length;
            for (let i = lineCount; i > 0; --i) {
                let line = progressLines[i - 1].trim();
                let prefix = line.substr(0, 6);
                if (prefix.startsWith('[') && prefix.endsWith(']')) {
                    // Found
                    Utils.log('nativeTransferFile, mode=[' + transferProcess.mode + '], progress line=[' + line + ']');
                    progressPercent = prefix.substr(1, 4);
                    progressPercent = progressPercent.trim();
                    break;
                }
            }
            if (progressPercent != '') {
                let percentInt = parseInt(progressPercent.substr(0, progressPercent.length - 1));
                transferProcess.percent = percentInt;
                let hasSpeed = false;
                let transferSpeed = '';
                if (transferProcess.mode == 'pull') {
                    let curTime = Date.now();
                    let transferTime = (curTime - transferProcess.startTime) / 1000.0;
                    if (transferTime > 3) {
                        hasSpeed = true;
                        let bytesTransferred = (percentInt / 100.0) * transferProcess.totalSize;
                        transferSpeed = bytesTransferred / transferTime;
                        //Utils.log('nativeTransferFile, ' + transferTime + 's @ ' + transferSpeed + 'B/s');
                        transferSpeed = Utils.byteSizeToShortSize(transferSpeed) + 'B/s';
                        transferProcess.transferSpeed = transferSpeed;
                    }
                }
                let progressString = progressPercent;
                if (hasSpeed) {
                    progressString = progressString + ' (' + transferSpeed + ')';
                }
                onProgressCallback(progressString);
            }
        }, (child, exitCode, err) => {
            // On process finished
            let adbTransferResult = {};
            adbTransferResult.code = 0;
            adbTransferResult.err = '';
            adbTransferResult.message = '';

            if (err != 0) {
                adbTransferResult.code = exitCode;
                adbTransferResult.err = 'nativeTransferFile, mode=[' + transferProcess.mode + '], [' + filePath + '] failed';
                onFinishedCallback(adbTransferResult);
                return;
            }

            if (exitCode != 0) {
                adbTransferResult.code = -1;
                adbTransferResult.err = err.message;
                onFinishedCallback(adbTransferResult);
                return;
            }

            if (transferProcess.transferSpeed && transferProcess.transferSpeed != '') {
                adbTransferResult.message = ' (' + transferProcess.transferSpeed + ')';
            }
            onFinishedCallback(adbTransferResult);
        });

        return cmd;
    }

    adbkitTransferFile(transferProcess, filePath, destPath, onProgressCallback, onFinishedCallback) {
        let adbkitDeviceClient = this.adbkitClient.getDevice(this.curDevice);
        adbkitDeviceClient.syncService().then((sync) => {
            let adbTransferResult = {};
            adbTransferResult.code = 0;
            adbTransferResult.err = '';
            adbTransferResult.message = '';

            transferProcess.sync = sync;

            if (transferProcess.mode == 'pull') {
                let fileSize = 0;
                sync.stat(filePath).then((stats) => {
                    fileSize = stats.size;

                    if (adbTransferResult.code != 0 || fileSize == 0) {
                        onFinishedCallback(adbTransferResult);
                        return;
                    }

                    transferProcess.totalSize = fileSize;
                    transferProcess.startTime = Date.now();

                    let pullTransfer = sync.pull(filePath);
                    pullTransfer.on('progress', (stats) => {
                        let curTime = Date.now();
                        if (stats.bytesTransferred > transferProcess.totalSize) {
                            // adbkit cannot handle 4GB
                            transferProcess.totalSize = transferProcess.totalSize + 4 * 1024 * 1024 * 1024;
                            Utils.log('adbkitTransferFile, fix adbkit cannot handle 4GB');
                        }
                        let progressPercent = Math.floor((stats.bytesTransferred * 100) / transferProcess.totalSize);
                        transferProcess.percent = progressPercent;
                        let transferSpeed = '';
                        let hasSpeed = false;
                        let transferTime = (curTime - transferProcess.startTime) / 1000.0;
                        if (transferTime > 3) {
                            hasSpeed = true;
                            transferSpeed = stats.bytesTransferred / transferTime;
                            //Utils.log('adbkitTransferFile, ' + transferTime + 's @ ' + transferSpeed + 'B/s');
                            transferSpeed = Utils.byteSizeToShortSize(transferSpeed) + 'B/s';
                            transferProcess.transferSpeed = transferSpeed;
                        }
                        let progressString = progressPercent + '%';
                        if (hasSpeed) {
                            progressString = progressString + ' (' + transferSpeed + ')';
                        }
                        onProgressCallback(progressString);
                    });
                    pullTransfer.on('end', () => {
                        if (transferProcess.transferSpeed && transferProcess.transferSpeed != '') {
                            adbTransferResult.message = ' (' + transferProcess.transferSpeed + ')';
                        }
                        onFinishedCallback(adbTransferResult);
                    });
                    pullTransfer.on('error', (err) => {
                        adbTransferResult.code = err.name;
                        adbTransferResult.err = 'adbkitTransferFile, mode=[' + transferProcess.mode + '], [' + filePath + '] failed';
                    });

                    let basename = Path.basename(filePath);
                    let fullDestPath = Path.join(destPath, basename);
                    pullTransfer.pipe(Fs.createWriteStream(fullDestPath));
                });
            } else if (transferProcess.mode == 'push') {
                let fileSize = 0;
                let fileStats = Fs.statSync(filePath);
                fileSize = fileStats.size;

                if (fileSize == 0) {
                    onFinishedCallback(adbTransferResult);
                    return;
                }

                transferProcess.totalSize = fileSize;
                let basename = Path.basename(filePath);
                let fullDestPath = destPath + basename;
                let pullTransfer = sync.pushFile(filePath, fullDestPath);
                pullTransfer.on('progress', (stats) => {
                    let progressPercent = Math.floor((stats.bytesTransferred * 100) / transferProcess.totalSize);
                    transferProcess.percent = progressPercent;
                    onProgressCallback(progressPercent + '%');
                });
                pullTransfer.on('end', () => {
                    onFinishedCallback(adbTransferResult);
                });
                pullTransfer.on('error', (err) => {
                    adbTransferResult.code = err.name;
                    adbTransferResult.err = 'adbkitTransferFile, mode=[' + transferProcess.mode + '], [' + filePath + '] failed';
                });
            }
        });
    }

    getTransferFileCount() {
        return Object.keys(this.transferProcessList).length;
    }

    getTransferFileMinProgress() {
        let minProgress = 100;
        for (const transferId of Object.keys(this.transferProcessList)) {
            let transferProgress = this.transferProcessList[transferId].percent;
            if (transferProgress < minProgress) {
                minProgress = transferProgress;
            }
        }

        return minProgress;
    }

    stopTransferFile(transferId) {
        if (transferId in this.transferProcessList) {
            if (!this.usingAdbkit) {
                let transferCmd = this.transferProcessList[transferId].cmd;
                transferCmd.stop();
            } else {
                let transferSync = this.transferProcessList[transferId].sync;
                transferSync.end();
            }
        }
    }

    stopAllTransferFile() {
        for (const transferId of Object.keys(this.transferProcessList)) {
            if (!this.usingAdbkit) {
                let transferCmd = this.transferProcessList[transferId].cmd;
                transferCmd.stop();
            } else {
                let transferSync = this.transferProcessList[transferId].sync;
                transferSync.end();
            }
        }
    }
}

// exports
exports.isFileDir = isFileDir;
exports.isFileLink = isFileLink;
exports.isPermissionDenied = isPermissionDenied;
exports.ADBHelper = ADBHelper;
