const Utils = require('./utils.js');
const ADBHelper = require('./adb-helper.js');

const CMD_DELIMITER = '/';
const CMD_SELECT_DEVICE = 'select-device';
const CMD_LS_DIR = 'ls';

var adbHelper = 0;

var divDeviceList = 0;
var divDirList = 0;

function init() {
    adbHelper = new ADBHelper.ADBHelper('adb');

    divDeviceList = $('#divDeviceList');
    divDirList = $('#divDirList');

    clearDeviceList();
    clearDirList();
}

function clearDeviceList() {
    divDeviceList.empty();
}

function clearDirList() {
    divDirList.empty();
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
                var lsDirCmd = CMD_LS_DIR + CMD_DELIMITER + fileName;
                var aDirLink = $('<a/>').text(fileName).attr('href', lsDirCmd).click(function () {
                        return handleCmdClick($(this));
                    });
                divFileName.append(aDirLink);
            } else {
                divFileName.text(fileName);
            }
            divFileLine.append(divFileName);

            var divFileTypeOrSize = $('<div/>').addClass('fileTypeOrSize');
            if (ADBHelper.isFileDir(file)) {
                divFileTypeOrSize.text('Folder');
            } else {
                divFileTypeOrSize.text(file.size);
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
        $(window).scrollTop(0);
    });
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

function setCurrentDir(path) {
    adbHelper.setCurDir(path);
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
    }
    return false;
}

function selectDeviceAndRefreshRootDir(device) {
    adbHelper.setCurDevice(device);
    setCurrentDir('/');
    refreshDirList();
}

$(function () {
    init();

    refreshDeviceList();
});
