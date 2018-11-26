const OS = require('os');
const Path = require('path');

const Utils = require('./utils.js');
const ADBHelper = require('./adb-helper.js');

const CMD_DELIMITER = '/';
const CMD_SELECT_DEVICE = 'select-device';
const CMD_LS_DIR = 'ls';
const CMD_PULL = 'pull';
const CMD_STOP_PULL = 'stop-pull';

var adbHelper = 0;

var divDeviceList = 0;
var divTransferList = 0;
var divDirWrapper = 0;
var divDirList = 0;

function init() {
    adbHelper = new ADBHelper.ADBHelper('adb');

    $(window).on('beforeunload', function () {
        adbHelper.stopAllPullFile();
    });

    divDeviceList = $('#divDeviceList');
    divTransferList = $('#divTransferList');
    divDirWrapper = $('#divDirWrapper');
    divDirList = $('#divDirList');

    clearDeviceList();
    clearTransferList();
    clearDirList();

    fitDirWrapperHeight();
    $(window).resize(() => {
        fitDirWrapperHeight();
    })
}

function clearDeviceList() {
    divDeviceList.empty();
}

function clearTransferList() {
    divTransferList.empty();
}

function clearDirList() {
    divDirList.empty();
}

function fitDirWrapperHeight() {
    var windowHeight = $(window).height();
    var divDirWrapperHeight = windowHeight - divDirWrapper.offset().top - 60;
    divDirWrapper.css('height', divDirWrapperHeight + 'px');
}

function refreshDeviceList() {
    adbHelper.getDevices((adbDevicesResult) => {
        clearDeviceList();

        if (adbDevicesResult.code != 0) {
            divDeviceList.text('Error: ' + adbDevicesResult.code + ', ' + adbDevicesResult.err);
            return;
        }

        var devices = adbDevicesResult.devices;
        if (devices.length == 0) {
            divDeviceList.text('No device found');
        } else {
            for (const device of devices) {
                var deviceAvailable = (device.status == 'device');

                var divDeviceLine = $('<div/>').addClass('deviceLine');
                var divDeviceId = $('<div/>').addClass('deviceId');
                if (deviceAvailable) {
                    var selectDeviceCmd = CMD_SELECT_DEVICE + CMD_DELIMITER + device.id;
                    var aDeviceLink = $('<a/>').text(device.id).attr('href', selectDeviceCmd).click(function () {
                            return handleCmdClick($(this));
                        });
                    divDeviceId.append(aDeviceLink);
                } else {
                    divDeviceId.text(device.id);
                }
                divDeviceLine.append(divDeviceId);

                var divDeviceStatus = $('<div/>').addClass('deviceStatus').text(device.status);
                divDeviceLine.append(divDeviceStatus);

                divDeviceList.append(divDeviceLine);
            }
        }
    });
}

function setCurrentDir(path) {
    adbHelper.setCurDir(path);
}

function sortDirList(dirList) {
    dirList.sort((file1, file2) => {
        var file1Dir = ADBHelper.isFileDir(file1);
        var file2Dir = ADBHelper.isFileDir(file2);
        if (file1Dir && !file2Dir) {
            return -1;
        }
        if (!file1Dir && file2Dir) {
            return 1;
        }
        // 1 and 2 are all dir/file
        return file1.name.localeCompare(file2.name);
    });
}

function refreshDirList() {
    // setCurDir first!
    adbHelper.getDirList((adbDirListResult) => {
        clearDirList();

        if (adbDirListResult.code != 0) {
            divDirList.text('Error: ' + adbDirListResult.code + ', ' + adbDirListResult.err);
            return;
        }

        // Go up
        var curDir = adbHelper.getCurDir();
        curDir = curDir.substr(0, curDir.length - 1);
        var pathDelimIdx = curDir.lastIndexOf('/');
        if (pathDelimIdx >= 0) {
            // Not root
            var divFileLine = $('<div/>').addClass('fileLine');

            var divFileName = $('<div/>').addClass('fileName');
            var lsDirCmd = CMD_LS_DIR + CMD_DELIMITER + '..';
            var aDirLink = $('<a/>').text('..').attr('href', lsDirCmd).click(function () {
                    return handleCmdClick($(this));
                });
            divFileName.append(aDirLink);
            divFileLine.append(divFileName);

            var divFileTypeOrSize = $('<div/>').addClass('fileTypeOrSize');
            divFileLine.append(divFileTypeOrSize);

            var divFileModified = $('<div/>').addClass('fileModified');
            divFileLine.append(divFileModified);

            divDirList.append(divFileLine);
        }

        var dirList = adbDirListResult.dirList;
        sortDirList(dirList);
        for (var file of dirList) {
            var divFileLine = $('<div/>').addClass('fileLine');

            var divFileName = $('<div/>').addClass('fileName');
            var fileName = file.name;
            if (ADBHelper.isFileDir(file)) {
                // Directory
                var lsDirCmd = CMD_LS_DIR + CMD_DELIMITER + fileName;
                var aDirLink = $('<a/>').text(fileName).attr('href', lsDirCmd).click(function () {
                        return handleCmdClick($(this));
                    });
                divFileName.append(aDirLink);
            } else {
                // File
                var pullFileCmd = CMD_PULL + CMD_DELIMITER + fileName;
                var aFileLink = $('<a/>').text(fileName).attr('href', pullFileCmd).click(function () {
                        return handleCmdClick($(this));
                    });
                divFileName.append(aFileLink);
            }
            divFileLine.append(divFileName);

            var divFileTypeOrSize = $('<div/>').addClass('fileTypeOrSize');
            if (ADBHelper.isFileDir(file)) {
                divFileTypeOrSize.text('Folder');
            } else {
                divFileTypeOrSize.text(Utils.byteSizeToShortSize(file.size) + 'B');
            }
            divFileLine.append(divFileTypeOrSize);

            var divFileModified = $('<div/>').addClass('fileModified');
            if (!ADBHelper.isPermissionDenied(file)) {
                divFileModified.text(file.modified);
            } else {
                divFileModified.text('Permission denied');
            }
            divFileLine.append(divFileModified);

            divDirList.append(divFileLine);
        }

        // Scroll to top
        divDirWrapper.scrollTop(0);
    });
}

function selectDeviceAndRefreshRootDir(device) {
    adbHelper.setCurDevice(device);
    setCurrentDir('/');
    refreshDirList();
}

function pullFile(path) {
    Utils.log('pullFile=[' + path + ']');

    var fileName = Path.basename(path);
    var divPullLine = $('<div/>').addClass('pullLine');
    var divFileName = $('<div/>').addClass('fileName').text(fileName);
    divPullLine.append(divFileName);
    var divPullProgress = $('<div/>').addClass('pullProgress').text('Pulling...');
    divPullLine.append(divPullProgress);
    var divPullStop = $('<div/>').addClass('pullStop');
    divPullLine.append(divPullStop);
    divTransferList.prepend(divPullLine);

    var homeDir = OS.homedir();
    if (!homeDir.endsWith('/')) {
        homeDir = homeDir + '/';
    }
    const downloadDir = homeDir + 'Downloads/';
    const pullId = adbHelper.pullFile(path, downloadDir, (progressPercent) => {
            divPullProgress.text(progressPercent);
        }, (adbPullResult) => {
            if (adbPullResult.code == 0) {
                divPullProgress.text('Done');
            } else {
                divPullProgress.text('Failed');
            }
        });

    var stopPullCmd = CMD_STOP_PULL + CMD_DELIMITER + pullId;
    var aStopPullLink = $('<a/>').text('Stop').attr('href', stopPullCmd).click(function () {
            return handleCmdClick($(this));
        });
    divPullStop.append(aStopPullLink);
}

function stopPullFile(pullId) {
    adbHelper.stopPullFile(pullId);
}

function handleCmdClick(cmdLink) {
    // CMD/PARAMETER
    var cmd = '';
    if (cmdLink.is('[href]')) {
        cmd = cmdLink.attr('href');
    } else {
        cmd = cmdLink.attr('rel');
    }
    Utils.log('handleCmdClick=[' + cmd + ']');
    var delimiterIdx = cmd.indexOf(CMD_DELIMITER);
    var adbCmd = cmd.substr(0, delimiterIdx);
    var adbCmdParam = cmd.substr(delimiterIdx + 1);
    switch (adbCmd) {
    case CMD_SELECT_DEVICE:
        const device = adbCmdParam;
        selectDeviceAndRefreshRootDir(device);
        break;
    case CMD_LS_DIR:
        var path = '';
        if (adbCmdParam != '..') {
            path = adbHelper.getCurDir() + adbCmdParam + '/';
        } else {
            // Go up
            var curDir = adbHelper.getCurDir();
            curDir = curDir.substr(0, curDir.length - 1);
            var pathDelimIdx = curDir.lastIndexOf('/');
            var upDirPath = curDir.substr(0, pathDelimIdx);
            path = upDirPath + '/';
        }
        setCurrentDir(path);
        refreshDirList();
        break;
    case CMD_PULL:
        const filePath = adbHelper.getCurDir() + adbCmdParam;
        pullFile(filePath);
        break;
    case CMD_STOP_PULL:
        const pullId = adbCmdParam;
        stopPullFile(pullId);
        break;
    }
    return false;
}

$(function () {
    init();

    refreshDeviceList();
});
