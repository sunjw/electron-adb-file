const Utils = require('./utils.js');
const ADBHelper = require('./adb-helper.js');

var divFileList = 0;

function init() {
    divFileList = $('#divFileList');
}

function clearFileList() {
    divFileList.empty();
}

function displayDevices() {
    var adbHelper = new ADBHelper.ADBHelper('adb');
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
                    var aDeviceLink = $('<a/>').text(device.id).attr('href', '#' + device.id).click(function () {
                            const deviceId = $(this).attr('href').substr(1);
                            alert('Device [' + deviceId + '] selected');
                            Utils.log('Device [' + deviceId + '] selected');
                            return false;
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
    clearFileList();

    displayDevices();
});
