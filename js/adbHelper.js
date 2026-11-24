const Fs = require('fs');
const Path = require('path');

const Adbkit = require('@sunjw8888/adbkit');

const Utils = require('./utils.js');
const ChildProcessHelper = require('./childProcessHelper.js');
const ADBUtils = require('./adbUtils.js');

const SPEED_START_INTERVAL = 2; // s
const SPEED_REFRESH_INTERVAL = 500; // ms

class ADBHelper {
    constructor(adbPath) {
        this.adbPath = adbPath;
        // TODO(refactor): These two are only a fallback for the calls that
        // have not been moved to the worker yet. The device and the
        // directory live in js/adbClient.js and are passed in as arguments.
        // Remove these two fields, and the accessors that go with them,
        // once the refactor is done.
        this.curDevice = '';
        this.curDir = '';
        this.transferProcessList = {};

        this.adbkitClient = Adbkit.Adb.createClient();
        Utils.log('using Adbkit...');

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

                let [id, status] = line.split('\t');
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

    // TODO(refactor): The accessors below and the two fields they use are
    // only a fallback. The device and the directory come in as arguments,
    // see the callers of getDirList and transferFile.

    getCurDevice() {
        return this.curDevice;
    }

    getCurDeviceCmdBase(curDevice) {
        // TODO(refactor): Drop the fallback once every caller passes the
        // device in.
        if (curDevice == null) {
            curDevice = this.curDevice;
        }
        return ['-s', curDevice];
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

    getDirList(curDevice, curDir, onDirListCallback) {
        // The device and the directory come from the caller. They are still
        // kept here as a fallback, until the renderer always passes them.
        // TODO(refactor): Drop the fallback once every caller passes the
        // device and the directory in.
        if (curDevice == null) {
            curDevice = this.curDevice;
        }
        if (curDir == null) {
            curDir = this.curDir;
        }

        let adbDirListResult = {};
        adbDirListResult.code = 0;
        adbDirListResult.err = '';
        adbDirListResult.dirList = [];

        // Check
        if (!curDir.endsWith('/')) {
            adbDirListResult.code = -1;
            adbDirListResult.err = 'Current directory error: [' + curDir + ']';
            onDirListCallback(adbDirListResult);
            return;
        }

        const fixedAdbShellPath = Utils.escapeShellPath(curDir);
        let cmdArgs = this.getCurDeviceCmdBase(curDevice).concat(['shell', 'ls', '-al', fixedAdbShellPath]);
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
                        fileName = fileName.substring(0, fileName.length - 1);
                    }
                    let pathDelimIdx = fileName.lastIndexOf('/');
                    if (pathDelimIdx >= 0) {
                        fileName = fileName.substring(pathDelimIdx + 1);
                    }
                    file.mode = ADBUtils.MODE_PERMISSION_DENIED;
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
                    lineNamePart = lineNamePart.substring(lineNamePart.indexOf(detailPart) + detailPart.length);
                }
                file.name = lineNamePart.trim();
                if (ADBUtils.isFileLink(file)) {
                    file.name = file.name.split('->')[0].trim();
                }

                if (file.name == '.' || file.name == '..') {
                    continue;
                }
                adbDirListResult.dirList.push(file);
            }

            // Fix link
            for (let file of adbDirListResult.dirList) {
                if (!ADBUtils.isFileLink(file)) {
                    continue;
                }

                //Utils.log('[' + file.name + '] is a link');
                let tryPath = curDir + file.name + '/';
                // Run some sync child_process in async callback
                let cmdArgs = this.getCurDeviceCmdBase(curDevice).concat(['shell', 'cd', tryPath]);
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

    transferFile(transferMode, filePath, destPath, curDevice, transferId, onProgressCallback, onFinishedCallback) {
        // The device comes from the caller. It is still kept here as a
        // fallback, until the renderer always passes it.
        // TODO(refactor): Drop the fallback once every caller passes the
        // device in.
        if (curDevice == null) {
            curDevice = this.curDevice;
        }

        // The transfer id comes from the caller as well. The renderer
        // generates it, so that it can build the stop link right away.
        let transferProcessList = this.transferProcessList;
        transferProcessList[transferId] = {};
        transferProcessList[transferId].mode = transferMode;
        transferProcessList[transferId].percent = 0;
        transferProcessList[transferId].lastSpeedTime = 0;

        let onFinishedCallbackWrapper = function (adbTransferResult) {
            // A transfer can finish twice: the stop and the end of the
            // stream can both come in. The second one finds the entry
            // gone, and must not do anything.
            let transferProcess = transferProcessList[transferId];
            if (!transferProcess) {
                return;
            }
            if (transferProcess.sync) {
                transferProcess.sync.end();
            }
            delete transferProcessList[transferId];
            Utils.log('transferFile.onFinishedCallbackWrapper, end, transferId=[' + transferId + ']');
            onFinishedCallback(adbTransferResult);
        };

        transferProcessList[transferId].onEnd = function () {
            let adbTransferResult = {};
            adbTransferResult.code = -1;
            adbTransferResult.err = 'adbkitTransferFile, mode=[' + transferMode + '], [' + filePath + '] stopped';
            adbTransferResult.message = '';
            onFinishedCallbackWrapper(adbTransferResult);
        };
        Utils.log('transferFile, begin, transferId=[' + transferId + ']');
        this.adbkitTransferFile(transferProcessList[transferId],
            filePath, destPath, curDevice, onProgressCallback, onFinishedCallbackWrapper);

        return transferId;
    }

    adbkitTransferFile(transferProcess, filePath, destPath, curDevice, onProgressCallback, onFinishedCallback) {
        // TODO(refactor): Drop the fallback once every caller passes the
        // device in.
        if (curDevice == null) {
            curDevice = this.curDevice;
        }
        let adbkitDeviceClient = this.adbkitClient.getDevice(curDevice);
        adbkitDeviceClient.syncService().then((sync) => {
            let adbTransferResult = {};
            adbTransferResult.code = 0;
            adbTransferResult.err = '';
            adbTransferResult.message = '';

            transferProcess.sync = sync;

            if (transferProcess.mode == 'pull') {
                let fileSize = 0;
                sync.sta2(filePath).then((stats) => {
                    fileSize = Number(stats.sizeBig);
                    // Utils.log('adbkitTransferFile, fileSize=' + fileSize);

                    if (adbTransferResult.code != 0 || fileSize == 0) {
                        onFinishedCallback(adbTransferResult);
                        return;
                    }

                    transferProcess.totalSize = fileSize;
                    transferProcess.startTime = Utils.getCurTimestamp();

                    let pullTransfer = sync.pull(filePath);
                    pullTransfer.on('progress', (stats) => {
                        let curTime = Utils.getCurTimestamp();
                        if (stats.bytesTransferred > transferProcess.totalSize) {
                            // adbkit cannot handle 4GB
                            transferProcess.totalSize = transferProcess.totalSize + 4 * 1024 * 1024 * 1024;
                            Utils.log('adbkitTransferFile, fix adbkit cannot handle 4GB');
                        }
                        let progressPercent = Math.floor((stats.bytesTransferred * 100) / transferProcess.totalSize);
                        transferProcess.percent = progressPercent;
                        let transferSpeed = '';
                        let transferTime = (curTime - transferProcess.startTime) / 1000.0;
                        if (transferTime > SPEED_START_INTERVAL &&
                            (curTime - transferProcess.lastSpeedTime) >= SPEED_REFRESH_INTERVAL) {
                            transferSpeed = stats.bytesTransferred / transferTime;
                            //Utils.log('adbkitTransferFile, ' + transferTime + 's @ ' + transferSpeed + 'B/s');
                            transferSpeed = Utils.byteSizeToShortSize(transferSpeed) + 'B/s';
                            transferProcess.transferSpeed = transferSpeed;
                            transferProcess.lastSpeedTime = curTime;
                        }
                        let progressString = progressPercent + '%';
                        if (transferProcess.lastSpeedTime > 0) {
                            progressString = progressString + ' (' + transferProcess.transferSpeed + ')';
                        }
                        onProgressCallback(progressPercent, progressString);
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
                let pushTransfer = sync.pushFile(filePath, fullDestPath);
                pushTransfer.on('progress', (stats) => {
                    let progressPercent = Math.floor((stats.bytesTransferred * 100) / transferProcess.totalSize);
                    transferProcess.percent = progressPercent;
                    onProgressCallback(progressPercent, progressPercent + '%');
                });
                pushTransfer.on('end', () => {
                    onFinishedCallback(adbTransferResult);
                });
                pushTransfer.on('error', (err) => {
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
            Utils.log('stopTransferFile, transferId=[' + transferId + ']');
            this.transferProcessList[transferId].onEnd();
        }
    }

    stopAllTransferFile() {
        for (const transferId of Object.keys(this.transferProcessList)) {
            this.transferProcessList[transferId].onEnd();
        }
    }
}

// exports
exports.ADBHelper = ADBHelper;
