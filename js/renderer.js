const {
    shell
} = require('electron');

const OS = require('os');
const Path = require('path');

const Utils = require('./utils.js');
const ADBHelper = require('./adb-helper.js');

const CMD_DELIMITER = '/';
const CMD_CLOSE_DIALOG = 'close-dialog';
const CMD_SELECT_DEVICE = 'select-device';
const CMD_SHOW_TRANSFER = 'show-transfer';
const CMD_CLICK_FILENAME = 'click-filename';
const CMD_LS_DIR = 'ls';
const CMD_PULL = 'pull';
const CMD_STOP_PULL = 'stop-pull';
const CMD_SHOW_PULL = 'show-pull';

var adbHelper = 0;

var aBtnUp = 0;
var aBtnSdcard = 0;
var aBtnTransfer = 0;
var divToolbarPath = 0;
var divDirWrapper = 0;
var divDirList = 0;
var divDialogWrapper = 0;
var divDialogTitle = 0;
var divDeviceList = 0;
var divTransferList = 0;
var divDialogButtonLine = 0;
var divDialogBackground = 0;
var divToast = 0;

var toastTimeoutId = 0;

function init() {
    adbHelper = new ADBHelper.ADBHelper('adb');

    $(window).on('beforeunload', function () {
        adbHelper.stopAllPullFile();
    });

    aBtnUp = $('#divToolbarWrapper #aBtnUp');
    aBtnSdcard = $('#divToolbarWrapper #aBtnSdcard');
    aBtnTransfer = $('#divToolbarWrapper #aBtnTransfer');
    divToolbarPath = $('#divToolbarPath');
    divDirWrapper = $('#divDirWrapper');
    divDirList = $('#divDirList');
    divDialogWrapper = $('#divDialogWrapper');
    divDialogTitle = $('#divDialogTitle');
    divDeviceList = $('#divDeviceList');
    divTransferList = $('#divTransferList');
    divDialogButtonLine = $('.divDialogButtonLine');
    divDialogBackground = $('#divDialogBackground');
    divToast = $('#divToast');

    initToolbar();
    initTransferList();

    clearDeviceList();
    clearDirList();

    onWindowResize();
    $(window).resize(function () {
        onWindowResize();
    });

    divDialogButtonLine.children('a').click(function () {
        return handleCmdClick($(this));
    });
}

function onWindowResize() {
    fitDirWrapperHeight();
    fitDialogPosition();
    fitFileNameWidth();
}

function initToolbar() {
    aBtnUp.addClass('disabled').click(function () {
        return handleCmdClick($(this));
    });
    aBtnSdcard.addClass('disabled').click(function () {
        return handleCmdClick($(this));
    });
    aBtnTransfer.addClass('disabled').click(function () {
        return handleCmdClick($(this));
    });
}

function updateTransferButton() {
    var count = 0;
    var pullLines = divTransferList.children('.pullLine');
    for (var pullLine of pullLines) {
        pullLine = $(pullLine);
        var pullProgress = pullLine.children('.pullProgress');
        if (!pullProgress.hasClass('finished')) {
            ++count;
        }
    }
    var btnTransferText = 'Transfer...';
    if (count > 0) {
        btnTransferText = 'Transfer(' + count + ')...';
    }
    aBtnTransfer.text(btnTransferText);
}

function initTransferList() {
    divTransferList.empty();
    var divNoTransfer = $('<div/>').attr('id', 'divNoTransfer').addClass('tips').text('No transfer.');
    divTransferList.append(divNoTransfer);
}

function clearDeviceList() {
    divDeviceList.empty();
}

function clearDirList() {
    divDirList.empty();
}

function fitDirWrapperHeight() {
    var windowHeight = $(window).height();
    var divDirWrapperHeight = windowHeight - divDirWrapper.offset().top - 5;
    if (divDirWrapperHeight < 20) {
        divDirWrapperHeight = 20;
    }
    divDirWrapper.css('height', divDirWrapperHeight + 'px');
}

function showDialogBackground() {
    divDialogBackground.show();
}

function hideDialogBackground() {
    divDialogBackground.hide();
}

function fitDialogPosition(ignoreHidden = false) {
    if (!ignoreHidden && divDialogWrapper.is(":hidden")) {
        return;
    }

    var windowWidth = $(window).width();
    var divDialogWrapperLeft = (windowWidth - divDialogWrapper.outerWidth()) / 2;
    if (divDialogWrapperLeft < 0) {
        divDialogWrapperLeft = 0;
    }
    divDialogWrapper.css('left', divDialogWrapperLeft + 'px');
}

function hideDialog() {
    divDialogWrapper.hide();
    hideDialogBackground();
    divDeviceList.hide();
    divTransferList.hide();
}

function showDialogBase(title) {
    divDialogTitle.text(title)
    fitDialogPosition(true);
    showDialogBackground();
    divDialogWrapper.show();
}

function showDeviceListDialog() {
    divDeviceList.show();
    divTransferList.hide();
    showDialogBase('Devices');
}

function showTransferListDialog() {
    divDeviceList.hide();
    divTransferList.show();
    showDialogBase('Transfer List');
}

function fitFileNameWidth() {
    var windowWidth = $(window).width();
    var fileNameWidth = windowWidth - 400;
    if (fileNameWidth < 0) {
        fileNameWidth = 0;
    }
    $(document.documentElement).css('--file-name-width', fileNameWidth + 'px');
}

function showToast(message) {
    divToast.html(message);
    divToast.fadeIn('slow');
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
            hideToast();
        }, 5000);
}

function hideToast() {
    divToast.fadeOut('slow');
}

function refreshDeviceList() {
    var divTips = $('<div/>').addClass('tips').text('Waiting for command running...');
    divDeviceList.append(divTips.text('Waiting for command running...'));
    // Run command
    adbHelper.getDevices((adbDevicesResult) => {
        clearDeviceList();

        if (adbDevicesResult.code != 0) {
            divDeviceList.append(divTips.text('Error: ' + adbDevicesResult.code + ', ' + adbDevicesResult.err));
            return;
        }

        var devices = adbDevicesResult.devices;
        if (devices.length == 0) {
            divDeviceList.append(divTips.text('No device found.'));
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

                var divDeviceStatus = $('<div/>').addClass('deviceStatus').text('Status: ' + device.status);
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

        // Up ..
        var curDir = adbHelper.getCurDir();
        curDir = curDir.substr(0, curDir.length - 1);
        var pathDelimIdx = curDir.lastIndexOf('/');
        if (pathDelimIdx >= 0) {
            // Not root
            var parentDir = Utils.getParentDir(curDir);
            var lsUpDirCmd = CMD_LS_DIR + CMD_DELIMITER + parentDir;
            aBtnUp.attr('href', lsUpDirCmd).removeClass('disabled');
        } else {
            aBtnUp.attr('href', '').addClass('disabled');
        }

        var dirList = adbDirListResult.dirList;
        sortDirList(dirList);
        for (var file of dirList) {
            var divFileLine = $('<div/>').addClass('fileLine');

            var divFileName = $('<div/>').addClass('fileName').attr('rel', CMD_CLICK_FILENAME).click(function () {
                    return handleCmdClick($(this));
                });
            var fileName = file.name;
            if (ADBHelper.isFileDir(file)) {
                // Directory
                var lsDirCmd = CMD_LS_DIR + CMD_DELIMITER + fileName;
                var aDirLink = $('<a/>').text(fileName).attr('href', lsDirCmd).click(function () {
                        return handleCmdClick($(this));
                    });
                divFileName.append(aDirLink);
                divFileName.addClass('fileDir');
            } else {
                // File
                var pullFileCmd = CMD_PULL + CMD_DELIMITER + fileName;
                var aFileLink = $('<a/>').text(fileName).attr('href', pullFileCmd).click(function () {
                        return handleCmdClick($(this));
                    });
                divFileName.append(aFileLink);
                divFileName.addClass('fileNormal');
            }
            divFileLine.append(divFileName);

            var divFileTypeOrSize = $('<div/>').addClass('fileTypeOrSize');
            if (ADBHelper.isFileDir(file)) {
                divFileTypeOrSize.text('Folder');
            } else {
                divFileTypeOrSize.text(Utils.byteSizeToShortSize(file.size) + 'B');
            }

            var divFileModified = $('<div/>').addClass('fileModified');
            if (!ADBHelper.isPermissionDenied(file)) {
                divFileModified.text(file.modified);
            } else {
                divFileModified.text('Permission denied');
            }

            var divFileRightPart = $('<div/>').addClass('fileRightPart');
            divFileRightPart.append(divFileTypeOrSize);
            divFileRightPart.append(divFileModified);

            divFileLine.append(divFileRightPart);

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

    // Enable buttons
    var lsSdcardCmd = CMD_LS_DIR + CMD_DELIMITER + '/sdcard/';
    var showTransferCmd = CMD_SHOW_TRANSFER;
    aBtnSdcard.attr('href', lsSdcardCmd).removeClass('disabled');
    aBtnTransfer.attr('href', showTransferCmd).removeClass('disabled');
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
    var divNoTransfer = divTransferList.children('#divNoTransfer');
    divNoTransfer.hide();
    divNoTransfer.after(divPullLine);

    var homeDir = OS.homedir();
    if (!homeDir.endsWith('/')) {
        homeDir = homeDir + '/';
    }
    const downloadDir = homeDir + 'Downloads/';
    const pullId = adbHelper.pullFile(path, downloadDir, (progressPercent) => {
            divPullProgress.text('Pull: ' + progressPercent);
        }, (adbPullResult) => {
            if (adbPullResult.code == 0) {
                divPullProgress.text('Pull: done');
                var pullPath = downloadDir + fileName;
                var showPullCmd = CMD_SHOW_PULL + CMD_DELIMITER + pullPath;
                var aShowPullLink = $('<a/>').text('Show').attr('href', showPullCmd).click(function () {
                        return handleCmdClick($(this));
                    });
                divPullStop.empty();
                divPullStop.append(aShowPullLink);
            } else {
                divPullProgress.text('Pull: failed');
                divPullStop.empty();
            }
            divPullProgress.addClass('finished');
            updateTransferButton();
            var toastMessage = 'Pull "';
            if (fileName.length > 40) {
                toastMessage = toastMessage + fileName.substr(0, 30) + '...';
            } else {
                toastMessage = toastMessage + fileName;
            }
            toastMessage = toastMessage + '" finished.';
            showToast(toastMessage);
        });

    // Stop button
    var stopPullCmd = CMD_STOP_PULL + CMD_DELIMITER + pullId;
    var aStopPullLink = $('<a/>').text('Stop').attr('href', stopPullCmd).click(function () {
            return handleCmdClick($(this));
        });
    divPullStop.append(aStopPullLink);

    // Update Transfer button
    updateTransferButton();
}

function stopPullFile(pullId) {
    adbHelper.stopPullFile(pullId);
}

function handleCmdClick(cmdLink) {
    // CMD/PARAMETER
    if (cmdLink.hasClass('disabled')) {
        // Disabled button
        return false;
    }

    var cmd = '';
    if (cmdLink.is('[href]')) {
        cmd = cmdLink.attr('href');
    } else {
        cmd = cmdLink.attr('rel');
    }
    Utils.log('handleCmdClick=[' + cmd + ']');
    var delimiterIdx = cmd.indexOf(CMD_DELIMITER);
    var adbCmd = '';
    var adbCmdParam = '';
    if (delimiterIdx >= 0) {
        adbCmd = cmd.substr(0, delimiterIdx);
        adbCmdParam = cmd.substr(delimiterIdx + 1);
    } else {
        adbCmd = cmd;
    }
    switch (adbCmd) {
    case CMD_CLOSE_DIALOG:
        hideDialog();
        break;
    case CMD_SELECT_DEVICE:
        const device = adbCmdParam;
        selectDeviceAndRefreshRootDir(device);
        hideDialog();
        break;
    case CMD_SHOW_TRANSFER:
        showTransferListDialog();
        break;
    case CMD_CLICK_FILENAME:
        // Actually click link
        const aFileLink = cmdLink.children('a');
        aFileLink.click();
        break;
    case CMD_LS_DIR:
        var path = '';
        if (!adbCmdParam.startsWith('/')) {
            // Relative path
            path = adbHelper.getCurDir() + adbCmdParam + '/';
        } else {
            // Absolute path
            path = adbCmdParam;
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
    case CMD_SHOW_PULL:
        const pullFilePath = adbCmdParam;
        shell.showItemInFolder(pullFilePath);
        break;
    }
    return false;
}

$(function () {
    init();

    refreshDeviceList();
    showDeviceListDialog();
});
