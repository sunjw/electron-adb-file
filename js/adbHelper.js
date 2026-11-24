const Fs = require('fs');
const Path = require('path');

const Adbkit = require('@sunjw8888/adbkit');

const Utils = require('./utils.js');
const ChildProcessHelper = require('./childProcessHelper.js');
const ADBComm = require('./adbComm.js');

const SPEED_START_INTERVAL = 2; // s
// The progress is reported to the caller at most this often. The speed
// does not have an interval of its own: it is computed whenever the
// progress is reported.
const PROGRESS_CALLBACK_INTERVAL = 500; // ms

class ADBHelper {
    constructor(adbPath) {
        this.adbPath = adbPath;
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

    getCurDeviceCmdBase(curDevice) {
        return ['-s', curDevice];
    }

    getDirList(curDevice, curDir, onDirListCallback) {
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
                    file.mode = ADBComm.MODE_PERMISSION_DENIED;
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
                if (ADBComm.isFileLink(file)) {
                    file.name = file.name.split('->')[0].trim();
                }

                if (file.name == '.' || file.name == '..') {
                    continue;
                }
                adbDirListResult.dirList.push(file);
            }

            // Fix link
            for (let file of adbDirListResult.dirList) {
                if (!ADBComm.isFileLink(file)) {
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
        // The transfer id comes from the caller as well. The renderer
        // generates it, so that it can build the stop link right away.
        let transferProcessList = this.transferProcessList;
        transferProcessList[transferId] = {};
        transferProcessList[transferId].mode = transferMode;
        transferProcessList[transferId].percent = 0;
        // When the progress was reported the last time. The first chunk
        // of data is always reported, no matter how soon it arrives.
        transferProcessList[transferId].lastReportTime = 0;

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

                        // The progress is not reported on every chunk of
                        // data, only every PROGRESS_CALLBACK_INTERVAL.
                        if ((curTime - transferProcess.lastReportTime) < PROGRESS_CALLBACK_INTERVAL) {
                            return;
                        }
                        transferProcess.lastReportTime = curTime;

                        // The speed is computed whenever the progress is
                        // reported, it has no interval of its own.
                        let transferSpeed = '';
                        let transferTime = (curTime - transferProcess.startTime) / 1000.0;
                        if (transferTime > SPEED_START_INTERVAL) {
                            transferSpeed = stats.bytesTransferred / transferTime;
                            //Utils.log('adbkitTransferFile, ' + transferTime + 's @ ' + transferSpeed + 'B/s');
                            transferSpeed = Utils.byteSizeToShortSize(transferSpeed) + 'B/s';
                            transferProcess.transferSpeed = transferSpeed;
                        }
                        let progressString = progressPercent + '%';
                        if (transferProcess.transferSpeed && transferProcess.transferSpeed != '') {
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
                    let curTime = Utils.getCurTimestamp();
                    let progressPercent = Math.floor((stats.bytesTransferred * 100) / transferProcess.totalSize);
                    transferProcess.percent = progressPercent;

                    // The progress is not reported on every chunk of
                    // data, only every PROGRESS_CALLBACK_INTERVAL.
                    if ((curTime - transferProcess.lastReportTime) < PROGRESS_CALLBACK_INTERVAL) {
                        return;
                    }
                    transferProcess.lastReportTime = curTime;

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
