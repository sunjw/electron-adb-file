const Utils = require('./utils.js');
const ADBHelper = require('./adb-helper.js');

var adbHelper = 0;

var divDeviceList = 0;
var divFileList = 0;

function init() {
    adbHelper = new ADBHelper.ADBHelper('adb');

    divDeviceList = $('#divDeviceList');
    divFileList = $('#divFileList');

    clearDeviceList();
    clearFileList();
}

function handleCmdClick(cmdLink) {
    var cmd = cmdLink.attr('href').substr(1);
    var delimiterIdx = cmd.indexOf(ADBHelper.CMD_DELIMITER);
    var adbCmd = cmd.substr(0, delimiterIdx);
    var adbCmdParam = cmd.substr(delimiterIdx + 1);
    switch (adbCmd) {
    case ADBHelper.CMD_SELECT_DEVICE:
        const device = adbCmdParam;
        adbHelper.setCurDevice(device);
        break;
    }
    return false;
}

function clearDeviceList() {
    divDeviceList.empty();
}

function clearFileList() {
    divFileList.empty();
}

function refreshDeviceList() {

    adbHelper.getDevices((adbDevices) => {
        clearFileList();
        if (adbDevices.length == 0) {
            divFileList.text('No device found');
        } else {
            for (const device of adbDevices) {
                var deviceAvailable = (device.status == 'device');

                var divDeviceId = $('<div/>').addClass('deviceId')
                    var divDeviceLine = $('<div/>').addClass('deviceLine');
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

                divFileList.append(divDeviceLine);
            }
        }
    });
}

$(function () {
    init();

    refreshDeviceList();
});
