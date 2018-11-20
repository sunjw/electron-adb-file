// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const Utils = require('./utils.js');
const ADBHelper = require('./adb-helper.js');

var divFileList = 0;

$(function () {
    divFileList = $('#divFileList');
    divFileList.empty();

    var adbHelper = new ADBHelper.ADBHelper('adb');
    adbHelper.getDevices((adbDevices) => {
        divFileList.text('Found devices: ' + adbDevices.length);
    });
});
