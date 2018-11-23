const Utils = require('./utils.js');
const ADBHelper = require('./adb-helper.js');

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
                    var selectDeviceCmd = ADBHelper.CMD_SELECT_DEVICE + ADBHelper.CMD_DELIMITER + device.id;
                    var aDeviceLink = $('<a/>').text(device.id).attr('href', '#' + selectDeviceCmd).click(function () {
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

function handleCmdClick(cmdLink) {
    // CMD/PARAMETER
    var cmd = cmdLink.attr('href').substr(1);
    var delimiterIdx = cmd.indexOf(ADBHelper.CMD_DELIMITER);
    var adbCmd = cmd.substr(0, delimiterIdx);
    var adbCmdParam = cmd.substr(delimiterIdx + 1);
    switch (adbCmd) {
    case ADBHelper.CMD_SELECT_DEVICE:
        const device = adbCmdParam;
        selectDeviceAndRefreshRootDir(device);
        break;
    }
    return false;
}

function selectDeviceAndRefreshRootDir(device) {
    adbHelper.setCurDevice(device);
    adbHelper.setCurDir('/');
    adbHelper.getDirList((adbDirListResult) => {
        clearDirList();

        if (adbDirListResult.code != 0) {
            divDirList.text('Error: ' + adbDirListResult.code + ', ' + adbDirListResult.err);
            return;
        }

        var dirList = adbDirListResult.dirList;
        for (var file of dirList) {
            var fileLine = $('<div/>').addClass('fileLine');

            var fileName = $('<div/>').addClass('fileName').text(file.name);
            fileLine.append(fileName);

            var fileTypeOrSize = $('<div/>').addClass('fileTypeOrSize');
            if (ADBHelper.isFileDir(file)) {
                fileTypeOrSize.text('Folder');
            } else {
                fileTypeOrSize.text(file.size);
            }
            fileLine.append(fileTypeOrSize);

            var fileModified = $('<div/>').addClass('fileModified');
            if (!ADBHelper.isPermissionDenied(file)) {
                fileModified.text(file.modified);
            } else {
                fileModified.text('Permission denied');
            }
            fileLine.append(fileModified);

            divDirList.append(fileLine);
        }
    });
}

$(function () {
    init();

    refreshDeviceList();
});
