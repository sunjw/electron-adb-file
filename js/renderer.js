const {
    ipcRenderer,
    shell
} = require('electron');
const remote = require('electron').remote;

const Path = require('path');

const electronFind = require('electron-find');
const fixPath = require('fix-path')();

const Utils = require('./utils.js');
const ADBHelper = require('./adb-helper.js');

const CMD_DELIMITER = '/';
const CMD_CLOSE_DIALOG = 'close-dialog';
const CMD_SHOW_DEVICE = 'show-device';
const CMD_SELECT_DEVICE = 'select-device';
const CMD_SHOW_HIDDEN = 'show-hidden';
const CMD_SHOW_TRANSFER = 'show-transfer';
const CMD_CLICK_FILENAME = 'click-filename';
const CMD_LS_DIR = 'ls';
const CMD_STOP_TRANSFER = 'stop-transfer';
const CMD_PULL = 'pull';
const CMD_SHOW_PULL = 'show-pull';

var adbHelper = 0;

var downloadsDirPath = 0;

var aBtnUp = 0;
var aBtnRefresh = 0;
var aBtnHiddenFile = 0;
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

var showHiddenFlag = false;

var findInPage = new electronFind.FindInPage(remote.getCurrentWebContents(), {
    offsetRight: 200
});
ipcRenderer.on('on-find', (e, args) => {
    findInPage.openFindWindow();
})

ipcRenderer.on('set-downloads-path', (event, arg) => {
    Utils.log('set-downloads-path=[' + arg + ']');
    downloadsDirPath = arg;
    if (!downloadsDirPath.endsWith('/')) {
        downloadsDirPath = downloadsDirPath + '/';
    }
});

function init() {
    adbHelper = new ADBHelper.ADBHelper('adb');

    aBtnUp = $('#divToolbarWrapper #aBtnUp');
    aBtnRefresh = $('#divToolbarWrapper #aBtnRefresh');
    aBtnHiddenFile = $('#divToolbarWrapper #aBtnHiddenFile');
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
    initDialog();
    initDirList();

    clearDeviceList();
    clearDirList();

    onWindowResize();
    $(window).resize(function () {
        onWindowResize();
    });
}

function onWindowResize() {
    fitToolbarPath();
    fitDirWrapperHeight();
    fitFileNameWidth();
    fitDialogPosition();
}

function initToolbar() {
    aBtnUp.addClass('disabled').click(function () {
        return handleCmdClick($(this));
    });
    aBtnRefresh.addClass('disabled').click(function () {
        return handleCmdClick($(this));
    });
    aBtnHiddenFile.addClass('disabled').click(function () {
        return handleCmdClick($(this));
    });
    aBtnSdcard.addClass('disabled').click(function () {
        return handleCmdClick($(this));
    });
    aBtnTransfer.addClass('disabled').click(function () {
        return handleCmdClick($(this));
    });
    var divToolbarPathDevice = divToolbarPath.children('#divToolbarPathDevice');
    var aDeviceLink = $('<a/>').text('No device selected').addClass('toolbarButton').attr('href', CMD_SHOW_DEVICE).click(function () {
        return handleCmdClick($(this));
    });
    divToolbarPathDevice.empty();
    divToolbarPathDevice.append(aDeviceLink);
}

function fitToolbarPath() {
    var divToolbarPathDevice = divToolbarPath.children('#divToolbarPathDevice');
    var divToolbarPathWrapper = divToolbarPath.children('#divToolbarPathWrapper');
    var divToolbarPathContainer = divToolbarPath.find('#divToolbarPathContainer');
    var divToolbarPathWidth = divToolbarPath.width();
    var divToolbarPathDeviceWidth = divToolbarPathDevice.outerWidth();
    var divToolbarPathWrapperWidth = divToolbarPathWidth - divToolbarPathDeviceWidth - 5;
    var divToolbarPathContainerLeft = 0;
    if (divToolbarPathContainer.outerWidth() > divToolbarPathWrapperWidth) {
        divToolbarPathContainerLeft = divToolbarPathWrapperWidth - divToolbarPathContainer.outerWidth();
        divToolbarPathWrapper.addClass('overflow');
    } else {
        divToolbarPathWrapper.removeClass('overflow');
    }
    divToolbarPathWrapper.css('width', divToolbarPathWrapperWidth + 'px');
    divToolbarPathContainer.css('left', divToolbarPathContainerLeft + 'px');
}

function initTransferList() {
    divTransferList.empty();
    var divNoTransfer = $('<div/>').attr('id', 'divNoTransfer').addClass('tips').text('No transfer.');
    divTransferList.append(divNoTransfer);
}

function updateTransferButton() {
    var count = adbHelper.getTransferFileCount();
    var transferProgress = 0;
    var minProgress = adbHelper.getTransferFileMinProgress();
    var btnTransferText = 'Transfer';
    if (count > 0) {
        transferProgress = minProgress;
        if (minProgress == 0 || minProgress == 100) {
            minProgress = '...';
        } else {
            minProgress = minProgress + '%';
        }
        btnTransferText = 'Transfer(' + minProgress + ')';
        if (!minProgress.endsWith('B')) {
            ipcRenderer.send('set-transfer-progress', transferProgress);
        }
    } else if (count == 0) {
        ipcRenderer.send('set-transfer-progress', 100);
    }
    aBtnTransfer.text(btnTransferText);
    ipcRenderer.send('set-transfer-count', count);
}

function clearDeviceList() {
    divDeviceList.empty();
}

function initDirList() {
    var divDirWrapperDom = divDirWrapper[0];
    var divDirUploadBackgroundDom = divDirWrapper.children('#divDirUploadBackground')[0];
    divDirWrapperDom.ondragover = function (e) {
        e.stopPropagation();
        divDirWrapper.addClass('dropFile');
        return false;
    };
    divDirUploadBackgroundDom.ondragleave = function () {
        divDirWrapper.removeClass('dropFile');
        return false;
    };
    divDirUploadBackgroundDom.ondragend = function () {
        divDirWrapper.removeClass('dropFile');
        return false;
    };
    divDirWrapperDom.ondrop = function (e) {
        divDirWrapper.removeClass('dropFile');
        e.preventDefault();
        for (var f of e.dataTransfer.files) {
            pushFile(f.path);
        }
        return false;
    };
}

function clearDirList() {
    divDirList.empty();
}

function fitDirWrapperHeight() {
    var windowHeight = $(window).height();
    var divDirWrapperTop = divDirWrapper.offset().top;
    var divDirWrapperHeight = windowHeight - divDirWrapperTop - 5;
    if (divDirWrapperHeight < 20) {
        divDirWrapperHeight = 20;
    }
    divDirWrapper.css('height', divDirWrapperHeight + 'px');
    divDirUploadBackground = divDirWrapper.children('#divDirUploadBackground');
    divDirUploadBackground.css('top', divDirWrapperTop + 'px');
    divDirUploadBackground.css('height', divDirWrapperHeight + 'px');
}

function initDialog() {
    divDialogButtonLine.children('a').click(function () {
        return handleCmdClick($(this));
    });
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

function showHidden() {
    showHiddenFlag = !showHiddenFlag;
    aBtnHiddenFile.html(showHiddenFlag ? 'Hide Hidden' : 'Show Hidden');
    aBtnRefresh.click();
}

function showTransferListDialog() {
    divDeviceList.hide();
    divTransferList.show();
    showDialogBase('Transfer List');
}

function fitFileNameWidth() {
    var windowWidth = $(window).width();
    var fileNameWidth = windowWidth - 350;
    if (fileNameWidth < 0) {
        fileNameWidth = 0;
    }
    $(document.documentElement).css('--file-name-width', fileNameWidth + 'px');
}

function showToast(message) {
    divToast.html(message);
    divToast.show();
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
        hideToast();
    }, 5000);
}

function hideToast() {
    divToast.hide();
}

function refreshDeviceList() {
    clearDeviceList();
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

function refreshDeviceAndShowDeviceDialog() {
    refreshDeviceList();
    showDeviceListDialog();
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

        var dirList = adbDirListResult.dirList;
        sortDirList(dirList);
        for (var file of dirList) {
            var fileName = file.name;
            if (!showHiddenFlag && fileName.startsWith('.')) {
                continue;
            }
            var fileNameHtml = Utils.escapeHtmlPath(fileName);
            var divFileLine = $('<div/>').addClass('fileLine');

            var divFileName = $('<div/>').addClass('fileName').attr('rel', CMD_CLICK_FILENAME).click(function () {
                return handleCmdClick($(this));
            });
            if (ADBHelper.isFileDir(file)) {
                // Directory
                var lsDirCmd = CMD_LS_DIR + CMD_DELIMITER + fileName;
                var aDirLink = $('<a/>').html(fileNameHtml).attr('href', lsDirCmd).click(function () {
                    return handleCmdClick($(this));
                });
                divFileName.append(aDirLink);
                divFileName.addClass('fileDir');
            } else {
                // File
                var pullFileCmd = CMD_PULL + CMD_DELIMITER + fileName;
                var aFileLink = $('<a/>').html(fileNameHtml).attr('href', pullFileCmd).click(function () {
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

    // Up
    var curDir = adbHelper.getCurDir();
    curDir = curDir.substr(0, curDir.length - 1);
    var pathDelimIdx = curDir.lastIndexOf('/');
    if (pathDelimIdx >= 0) {
        // Not root
        var parentDir = Utils.getParentDir(curDir);
        var lsUpDirCmd = CMD_LS_DIR + CMD_DELIMITER + parentDir;
        aBtnUp.attr('href', lsUpDirCmd).removeClass('disabled');
    } else {
        // Root
        aBtnUp.attr('href', '').addClass('disabled');
        var lsRootCmd = CMD_LS_DIR + CMD_DELIMITER + '/';
        aBtnRefresh.attr('href', lsRootCmd);
    }

    // Path bar
    var divToolbarPathContainer = divToolbarPath.find('#divToolbarPathContainer');
    divToolbarPathContainer.empty();
    var pathDirs = curDir.split('/');
    var pathPostfix = '/';
    for (var i = 0; i < pathDirs.length; ++i) {
        var pathDir = pathDirs[i].trim();
        pathDir = pathDir.trim();
        if (pathDir == '') {
            continue;
        }
        var pathDirHtml = pathDir + ' / ';
        pathDirHtml = Utils.escapeHtmlPath(pathDirHtml);
        pathPostfix = pathPostfix + pathDir + '/';
        var lsPathCmd = CMD_LS_DIR + CMD_DELIMITER + pathPostfix;
        if (i < pathDirs.length - 1) {
            var aPathDirLink = $('<a/>').html(pathDirHtml).addClass('toolbarButton').attr('href', lsPathCmd).click(function () {
                return handleCmdClick($(this));
            });
            divToolbarPathContainer.append(aPathDirLink);
        } else {
            // Last one
            divToolbarPathContainer.append($('<span/>').html(pathDirHtml));
            aBtnRefresh.attr('href', lsPathCmd);
        }
    }

    fitToolbarPath();
}

function selectDeviceAndRefreshRootDir(device) {
    adbHelper.setCurDevice(device);

    setCurrentDir('/');
    refreshDirList();

    // Enable buttons
    var lsRootCmd = CMD_LS_DIR + CMD_DELIMITER + '/';
    var lsSdcardCmd = CMD_LS_DIR + CMD_DELIMITER + '/sdcard/';
    var showHiddenCmd = CMD_SHOW_HIDDEN;
    var showTransferCmd = CMD_SHOW_TRANSFER;
    aBtnHiddenFile.attr('href', showHiddenCmd).removeClass('disabled');
    aBtnSdcard.attr('href', lsSdcardCmd).removeClass('disabled');
    aBtnTransfer.attr('href', showTransferCmd).removeClass('disabled');
    aBtnRefresh.removeClass('disabled');

    // Path bar
    var divToolbarPathDevice = divToolbarPath.children('#divToolbarPathDevice');

    var aDeviceLink = $('<a/>').text(device).addClass('toolbarButton').attr('href', CMD_SHOW_DEVICE).click(function () {
        return handleCmdClick($(this));
    });
    var aDeviceRootLink = $('<a/>').html('/&nbsp;').addClass('toolbarButton').attr('href', lsRootCmd).click(function () {
        return handleCmdClick($(this));
    });

    divToolbarPathDevice.empty();
    divToolbarPathDevice.append(aDeviceLink);
    divToolbarPathDevice.append(': ');
    divToolbarPathDevice.append(aDeviceRootLink);

    fitToolbarPath();
}

function transferFile(mode, path) {
    Utils.log('transferFile, mode=[' + mode + '], path=[' + path + ']');
    var modeText = (mode == 'pull') ? 'Pull' : 'Push';
    var fileName = Path.basename(path);
    var fileNameHtml = Utils.escapeHtmlPath(fileName);
    var divTransferLine = $('<div/>').addClass('transferLine');
    var divFileName = $('<div/>').addClass('fileName').html(fileNameHtml);
    divTransferLine.append(divFileName);
    var divTransferProgress = $('<div/>').addClass('transferProgress').text(modeText + 'ing...');
    divTransferLine.append(divTransferProgress);
    var divTransferStop = $('<div/>').addClass('transferStop');
    divTransferLine.append(divTransferStop);
    var divNoTransfer = divTransferList.children('#divNoTransfer');
    divNoTransfer.hide();
    divNoTransfer.after(divTransferLine);

    const destPath = (mode == 'pull') ? downloadsDirPath : adbHelper.getCurDir();
    const transferId = adbHelper.transferFile(mode, path, destPath, (progressPercent) => {
        divTransferProgress.text(modeText + ': ' + progressPercent);
        updateTransferButton();
    }, (adbTransferResult) => {
        if (adbTransferResult.code == 0) {
            divTransferProgress.text(modeText + ': done');
            divTransferStop.empty();
            if (mode == 'pull') {
                var pullPath = destPath + fileName;
                var showPullCmd = CMD_SHOW_PULL + CMD_DELIMITER + pullPath;
                var aShowPullLink = $('<a/>').text('Show').attr('href', showPullCmd).click(function () {
                    return handleCmdClick($(this));
                });
                divTransferStop.append(aShowPullLink);
            }
        } else {
            divTransferProgress.text(modeText + ': failed');
            divTransferStop.empty();
        }
        divTransferProgress.addClass('finished');
        updateTransferButton();
        fileNameHtml = fileName;
        if (fileName.length > 40) {
            fileNameHtml = fileName.substr(0, 30) + '...';
        }
        fileNameHtml = Utils.escapeHtmlPath(fileNameHtml);
        var toastMessage = modeText + ' "' + fileNameHtml + '" finished.';
        showToast(toastMessage);
    });

    // Stop button
    var stopTransferCmd = CMD_STOP_TRANSFER + CMD_DELIMITER + transferId;
    var aStopTransferLink = $('<a/>').text('Stop').attr('href', stopTransferCmd).click(function () {
        return handleCmdClick($(this));
    });
    divTransferStop.append(aStopTransferLink);

    // Update Transfer button
    updateTransferButton();
}

function stopTransferFile(pullId) {
    adbHelper.stopTransferFile(pullId);
}

function pullFile(path) {
    Utils.log('pullFile=[' + path + ']');
    transferFile('pull', path);
}

function pushFile(path) {
    Utils.log('pushFile=[' + path + ']');
    transferFile('push', path);
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
    case CMD_SHOW_DEVICE:
        refreshDeviceAndShowDeviceDialog();
        break;
    case CMD_SELECT_DEVICE:
        const device = adbCmdParam;
        selectDeviceAndRefreshRootDir(device);
        hideDialog();
        break;
    case CMD_SHOW_HIDDEN:
        showHidden();
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
    case CMD_STOP_TRANSFER:
        const transferId = adbCmdParam;
        stopTransferFile(transferId);
        break;
    case CMD_PULL:
        const filePath = adbHelper.getCurDir() + adbCmdParam;
        pullFile(filePath);
        break;
    case CMD_SHOW_PULL:
        const pullFilePath = Utils.fixWindowsPath(adbCmdParam);
        shell.showItemInFolder(pullFilePath);
        break;
    }
    return false;
}

$(function () {
    init();

    refreshDeviceAndShowDeviceDialog();
});
