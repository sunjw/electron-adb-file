const {
    ipcRenderer,
    shell
} = require('electron');
const remote = require('@electron/remote');

const Path = require('path');

window.$ = window.jQuery = require('jquery');
const bootstrap = require('bootstrap');
const fixPath = require('fix-path')();

const Utils = require('./utils');
const ADBHelper = require('./adb-helper');
const ListFilter = require('./listfilter');

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
const CMD_FILTER_DIR = 'filter-dir';
const CMD_FILTER_DIR_CLEAR = 'filter-dir-clear';
const CMD_WINDOW_MIN = 'window-min';
const CMD_WINDOW_MAX = 'window-max';
const CMD_WINDOW_RESTORE = 'window-restore';
const CMD_WINDOW_CLOSE = 'window-close';

const IMGSET_WINDOW_MIN = 'assets/min-k-10.png 1x, assets/min-k-12.png 1.25x, assets/min-k-15.png 1.5x, assets/min-k-15.png 1.75x, assets/min-k-20.png 2x, assets/min-k-20.png 2.25x, assets/min-k-24.png 2.5x, assets/min-k-30.png 3x, assets/min-k-30.png 3.5x';
const IMGSET_WINDOW_MAX = 'assets/max-k-10.png 1x, assets/max-k-12.png 1.25x, assets/max-k-15.png 1.5x, assets/max-k-15.png 1.75x, assets/max-k-20.png 2x, assets/max-k-20.png 2.25x, assets/max-k-24.png 2.5x, assets/max-k-30.png 3x, assets/max-k-30.png 3.5x';
const IMGSET_WINDOW_RESTORE = 'assets/restore-k-10.png 1x, assets/restore-k-12.png 1.25x, assets/restore-k-15.png 1.5x, assets/restore-k-15.png 1.75x, assets/restore-k-20.png 2x, assets/restore-k-20.png 2.25x, assets/restore-k-24.png 2.5x, assets/restore-k-30.png 3x, assets/restore-k-30.png 3.5x';
const IMGSET_WINDOW_CLOSE = 'assets/close-k-10.png 1x, assets/close-k-12.png 1.25x, assets/close-k-15.png 1.5x, assets/close-k-15.png 1.75x, assets/close-k-20.png 2x, assets/close-k-20.png 2.25x, assets/close-k-24.png 2.5x, assets/close-k-30.png 3x, assets/close-k-30.png 3.5x';

let adbHelper = null;

let downloadsDirPath = null;

let aBtnUp = null;
let aBtnRefresh = null;
let aBtnHiddenFile = null;
let aBtnAndroid = null;
let aBtnSdcard = null;
let aBtnTransfer = null;
let divTipsWaiting = null;
let divToolbarFunc = null;
let divToolbarPath = null;
let divDirWrapper = null;
let divDirList = null;
let divDialogWrapper = null;
let divDialogTitle = null;
let divDeviceList = null;
let divTransferList = null;
let divDialogButtonLine = null;
let divToast = null;

let modalDialogWrapper = null;
let modalOnHideCallback = null;

let toastTimeoutId = 0;
let showHiddenFlag = false;
let lastWaitingTipsTime = 0;
let transferTitle = 'Transfer';
let transferring = false;
let transferPendingFinish = false;

let dirListFilter = new ListFilter.ListFilter(remote.getCurrentWebContents());

ipcRenderer.on('on-find', (e, args) => {
    dirListFilter.openFilterBox();
})

ipcRenderer.on('set-downloads-path', (event, arg) => {
    Utils.log('set-downloads-path=[' + arg + ']');
    downloadsDirPath = arg;
    if (!downloadsDirPath.endsWith('/')) {
        downloadsDirPath = downloadsDirPath + '/';
    }
});

ipcRenderer.on('enter-full-screen', (event, arg) => {
    if (Utils.isMacOS()) {
        divToolbarFunc.removeClass('toolbarFuncFramelessMac');
    }
});

ipcRenderer.on('leave-full-screen', (event, arg) => {
    if (Utils.isMacOS()) {
        divToolbarFunc.addClass('toolbarFuncFramelessMac');
    }
});

function init() {
    adbHelper = new ADBHelper.ADBHelper('adb');

    aBtnUp = $('#divToolbarWrapper #aBtnUp');
    aBtnRefresh = $('#divToolbarWrapper #aBtnRefresh');
    aBtnHiddenFile = $('#divToolbarWrapper #aBtnHiddenFile');
    aBtnAndroid = $('#divToolbarWrapper #aBtnAndroid');
    aBtnSdcard = $('#divToolbarWrapper #aBtnSdcard');
    aBtnTransfer = $('#divToolbarWrapper #aBtnTransfer');

    divTipsWaiting = $('#divTipsWaiting');
    divToolbarFunc = $('#divToolbarFunc');
    divToolbarPath = $('#divToolbarPath');
    divDirWrapper = $('#divDirWrapper');
    divDirList = $('#divDirList');
    divDialogWrapper = $('#divDialogWrapper');
    divDialogTitle = $('#divDialogTitle');
    divDeviceList = $('#divDeviceList');
    divTransferList = $('#divTransferList');
    divDialogButtonLine = $('.divDialogButtonLine');
    divToast = $('#divToast');

    initToolbar();
    initTransferList();
    initDialog();
    initDirList();
    initFilter();

    clearDeviceList();
    clearDirList();

    onWindowResize();
    $(window).on('resize', function () {
        onWindowResize();
    });
}

function onWindowResize() {
    fitToolbarPath();
    fitDirWrapperHeight();
    fitFileNameWidth();
}

function initToolbar() {
    if (Utils.isWindows()) {
        divToolbarFunc.addClass('toolbarFuncFramelessWin');
        let divToolbarFuncRightPart = $('#divToolbarFuncRightPart');

        let aBtnWinMin = $('<a/>').attr({
            'id': 'aBtnWinMin',
            'href': CMD_WINDOW_MIN
        }).addClass('toolbarButton toolbarImgButton toolbarControlButton')
            .on('click', function () {
                return handleCmdClick($(this));
            });
        let imgBtnWinMin = $('<img/>').attr('srcset', IMGSET_WINDOW_MIN);
        aBtnWinMin.append(imgBtnWinMin);

        let aBtnWinMaxRestore = $('<a/>').attr({
            'id': 'aBtnWinMaxRestore'
        }).addClass('toolbarButton toolbarImgButton toolbarControlButton')
            .on('click', function () {
                return handleCmdClick($(this));
            });
        let imgBtnWinMaxRestore = $('<img/>');
        aBtnWinMaxRestore.append(imgBtnWinMaxRestore);
        let curWindow = remote.getCurrentWindow();
        if (curWindow.isMaximized()) {
            aBtnWinMaxRestore.attr('href', CMD_WINDOW_RESTORE);
            imgBtnWinMaxRestore.attr('srcset', IMGSET_WINDOW_RESTORE);
        } else {
            aBtnWinMaxRestore.attr('href', CMD_WINDOW_MAX);
            imgBtnWinMaxRestore.attr('srcset', IMGSET_WINDOW_MAX);
        }

        let aBtnWinClose = $('<a/>').attr({
            'id': 'aBtnWinClose',
            'href': CMD_WINDOW_CLOSE
        }).addClass('toolbarButton toolbarImgButton toolbarControlButton')
            .on('click', function () {
                return handleCmdClick($(this));
            });
        let imgBtnWinClose = $('<img/>').attr('srcset', IMGSET_WINDOW_CLOSE);
        aBtnWinClose.append(imgBtnWinClose);

        divToolbarFuncRightPart.append(aBtnWinMin);
        divToolbarFuncRightPart.append(aBtnWinMaxRestore);
        divToolbarFuncRightPart.append(aBtnWinClose);
    }
    if (Utils.isMacOS()) {
        divToolbarFunc.addClass('toolbarFuncFramelessMac');
    }

    aBtnUp.addClass('disabled').on('click', function () {
        return handleCmdClick($(this));
    });
    aBtnRefresh.addClass('disabled').on('click', function () {
        return handleCmdClick($(this));
    });
    aBtnHiddenFile.addClass('disabled').on('click', function () {
        return handleCmdClick($(this));
    });
    aBtnAndroid.addClass('disabled').on('click', function () {
        return handleCmdClick($(this));
    });
    aBtnSdcard.addClass('disabled').on('click', function () {
        return handleCmdClick($(this));
    });
    aBtnTransfer.addClass('disabled').on('click', function () {
        return handleCmdClick($(this));
    });
    let divToolbarPathDevice = divToolbarPath.children('#divToolbarPathDevice');
    let aDeviceLink = $('<a/>').text('No device selected').addClass('toolbarButton')
        .attr('href', CMD_SHOW_DEVICE).on('click', function () {
            return handleCmdClick($(this));
        });
    divToolbarPathDevice.empty();
    divToolbarPathDevice.append(aDeviceLink);
}

function fitToolbarPath() {
    let divToolbarPathDevice = divToolbarPath.children('#divToolbarPathDevice');
    let divToolbarPathWrapper = divToolbarPath.children('#divToolbarPathWrapper');
    let divToolbarPathContainer = divToolbarPath.find('#divToolbarPathContainer');
    let divToolbarPathWidth = divToolbarPath.width();
    let divToolbarPathDeviceWidth = divToolbarPathDevice.outerWidth();
    let divToolbarPathWrapperWidth = divToolbarPathWidth - divToolbarPathDeviceWidth - 5;
    let divToolbarPathContainerLeft = 0;
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
    let divNoTransfer = $('<div/>').attr('id', 'divNoTransfer').addClass('tips').text('No transfer.');
    divTransferList.append(divNoTransfer);
}

function updateTransferButton() {
    let count = adbHelper.getTransferFileCount();
    let transferProgress = 0;
    let minProgress = adbHelper.getTransferFileMinProgress();
    let btnTransferText = transferTitle;
    let spanFinishIcon = $('<span/>')
        .addClass('materialIcons material-icons-round')
        .text('done');
    if (count > 0) {
        transferring = true;
        transferPendingFinish = false;
        aBtnTransfer.removeClass('pendingFinish');
        transferProgress = minProgress;
        if (minProgress == 0 || minProgress == 100) {
            minProgress = '...';
        } else {
            minProgress = minProgress + '%';
        }
        btnTransferText = transferTitle + '&nbsp;(' + minProgress + ')';
        if (!minProgress.endsWith('B')) {
            ipcRenderer.send('set-transfer-progress', transferProgress);
        }
    } else if (count == 0) {
        ipcRenderer.send('set-transfer-progress', 100);
        if (transferring) {
            transferPendingFinish = true;
            transferring = false;
            btnTransferText = transferTitle + '&nbsp;(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)';
            aBtnTransfer.addClass('pendingFinish');
        }
    }
    aBtnTransfer.html(btnTransferText);
    if (transferPendingFinish) {
        aBtnTransfer.append(spanFinishIcon);
    }
    ipcRenderer.send('set-transfer-count', count);
}

function clearDeviceList() {
    divDeviceList.empty();
}

function initDirList() {
    let divDirWrapperDom = divDirWrapper[0];
    let divDirUploadBackgroundDom = divDirWrapper.children('#divDirUploadBackground')[0];
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
        for (let f of e.dataTransfer.files) {
            pushFile(f.path);
        }
        return false;
    };
}

function initFilter() {
    dirListFilter.setFilterButtonAttr({
        'rel': CMD_FILTER_DIR
    });
    dirListFilter.setCloseButtonAttr({
        'rel': CMD_FILTER_DIR_CLEAR
    });
    dirListFilter.setFilterHandler(function (linkButton) {
        return handleCmdClick(linkButton);
    });
    dirListFilter.setCloseHandler(function (linkButton) {
        return handleCmdClick(linkButton);
    });
}

function clearDirList() {
    divDirList.empty();
}

function fitDirWrapperHeight() {
    let windowHeight = $(window).height();
    let divDirWrapperTop = divDirWrapper.offset().top;
    let divDirWrapperHeight = windowHeight - divDirWrapperTop - 5;
    if (divDirWrapperHeight < 20) {
        divDirWrapperHeight = 20;
    }
    divDirWrapper.css('height', divDirWrapperHeight + 'px');
    divDirUploadBackground = divDirWrapper.children('#divDirUploadBackground');
    divDirUploadBackground.css('top', divDirWrapperTop + 'px');
    divDirUploadBackground.css('height', divDirWrapperHeight + 'px');
}

function initDialog() {
    modalDialogWrapper = new bootstrap.Modal(divDialogWrapper[0], {
        backdrop: 'static'
    });
    divDialogWrapper.on('hidden.bs.modal', function () {
        if (modalOnHideCallback) {
            modalOnHideCallback();
        }
    });
    divDialogButtonLine.children('a').on('click', function () {
        return handleCmdClick($(this));
    });
}

function hideDialog() {
    modalDialogWrapper.hide();
    divDeviceList.hide();
    divTransferList.hide();
}

function setOnHideDialogCallback(callback) {
    modalOnHideCallback = callback;
}

function showDialogBase(title) {
    divDialogTitle.text(title)
    modalDialogWrapper.show();
}

function showDeviceListDialog() {
    divDeviceList.show();
    divTransferList.hide();
    showDialogBase('Devices');
}

function showHidden() {
    showHiddenFlag = !showHiddenFlag;
    aBtnHiddenFile.html(showHiddenFlag ? 'Hide Hidden' : 'Show Hidden');
    aBtnRefresh.trigger('click');
}

function showTransferListDialog() {
    if (transferPendingFinish) {
        aBtnTransfer.html(transferTitle);
        transferPendingFinish = false;
        aBtnTransfer.removeClass('pendingFinish');
    }
    divDeviceList.hide();
    divTransferList.show();
    showDialogBase('Transfer List');
}

function fitFileNameWidth() {
    let windowWidth = $(window).width();
    let fileNameWidth = windowWidth - 350;
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

function showWaiting() {
    lastWaitingTipsTime = Date.now();
    divTipsWaiting.show();
}

function hideWaitingNow() {
    divTipsWaiting.hide();
}

function hideWaiting() {
    let curTime = Date.now();
    let gap = curTime - lastWaitingTipsTime;
    // Utils.log('gap=' + gap + 'ms');
    if (gap > 800) {
        hideWaitingNow();
        return;
    }
    setTimeout(() => {
        hideWaitingNow();
    }, gap);
}

function refreshDeviceList() {
    clearDeviceList();
    let divTips = $('<div/>').addClass('tips');
    divDeviceList.append(divTips.text('Waiting for command running...'));
    // Run command
    adbHelper.getDevices((adbDevicesResult) => {
        clearDeviceList();

        if (adbDevicesResult.code != 0) {
            divDeviceList.append(divTips.text('Error: ' + adbDevicesResult.code + ', ' + adbDevicesResult.err));
            return;
        }

        let devices = adbDevicesResult.devices;
        if (devices.length == 0) {
            divDeviceList.append(divTips.text('No device found.'));
        } else {
            for (const device of devices) {
                let deviceAvailable = (device.status == 'device');
                let divDeviceLine = $('<div/>').addClass('deviceLine');
                let divDeviceId = $('<div/>').addClass('deviceId');
                if (deviceAvailable) {
                    let selectDeviceCmd = CMD_SELECT_DEVICE + CMD_DELIMITER + device.id;
                    let aDeviceLink = $('<a/>').text(device.id).attr('href', selectDeviceCmd)
                        .on('click', function () {
                            return handleCmdClick($(this));
                        });
                    divDeviceId.append(aDeviceLink);
                } else {
                    divDeviceId.text(device.id);
                }
                divDeviceLine.append(divDeviceId);

                let divDeviceStatus = $('<div/>').addClass('deviceStatus').text('Status: ' + device.status);
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
        let file1Dir = ADBHelper.isFileDir(file1);
        let file2Dir = ADBHelper.isFileDir(file2);
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
    showWaiting();
    adbHelper.getDirList((adbDirListResult) => {
        clearDirList();

        if (adbDirListResult.code != 0) {
            divDirList.text('Error: ' + adbDirListResult.code + ', ' + adbDirListResult.err);
            return;
        }

        let dirList = adbDirListResult.dirList;
        sortDirList(dirList);

        let fileLineCount = 0;
        for (let file of dirList) {
            let fileName = file.name;
            if (!showHiddenFlag && fileName.startsWith('.')) {
                continue;
            }
            let fileNameHtml = Utils.escapeHtml(fileName);
            let divFileLine = $('<div/>').addClass('fileLine');

            let divFileName = $('<div/>').addClass('fileName')
                .attr({
                    'data-ref': fileName,
                    'rel': CMD_CLICK_FILENAME
                }).on('click', function () {
                    return handleCmdClick($(this));
                });
            let divFileNameIcon = $('<div/>').addClass('fileNameIcon');
            let divFileNameLink = $('<div/>').addClass('fileNameLink');
            if (ADBHelper.isFileDir(file)) {
                // Directory
                let spanDirIcon = $('<span/>').addClass('materialIcons material-icons-round').text('folder');
                divFileNameIcon.append(spanDirIcon);
                let lsDirCmd = CMD_LS_DIR + CMD_DELIMITER + fileName;
                let aDirLink = $('<a/>').html(fileNameHtml).attr('href', lsDirCmd)
                    .on('click', function () {
                        return handleCmdClick($(this));
                    });
                divFileNameLink.append(aDirLink);
                divFileName.addClass('fileDir');
            } else {
                // File
                let spanDirIcon = $('<span/>').addClass('materialIcons material-icons-outlined').text('insert_drive_file');
                divFileNameIcon.append(spanDirIcon);
                let pullFileCmd = CMD_PULL + CMD_DELIMITER + fileName;
                let aFileLink = $('<a/>').html(fileNameHtml).attr('href', pullFileCmd)
                    .on('click', function () {
                        return handleCmdClick($(this));
                    });
                divFileNameLink.append(aFileLink);
                divFileName.addClass('fileNormal');
            }
            divFileName.append(divFileNameIcon);
            divFileName.append(divFileNameLink);
            divFileLine.append(divFileName);

            let divFileTypeOrSize = $('<div/>').addClass('fileTypeOrSize');
            if (ADBHelper.isFileDir(file)) {
                divFileTypeOrSize.text('Folder');
            } else {
                divFileTypeOrSize.text(Utils.byteSizeToShortSize(file.size) + 'B');
            }

            let divFileModified = $('<div/>').addClass('fileModified');
            if (!ADBHelper.isPermissionDenied(file)) {
                divFileModified.text(file.modified);
            } else {
                divFileModified.text('Permission denied');
            }

            let divFileRightPart = $('<div/>').addClass('fileRightPart');
            divFileRightPart.append(divFileTypeOrSize);
            divFileRightPart.append(divFileModified);

            divFileLine.append(divFileRightPart);

            divDirList.append(divFileLine);
            fileLineCount++;
        }

        // Scroll to top
        divDirWrapper.scrollTop(0);
        hideWaiting();

        Utils.log('refreshDirList, fileLineCount=' + fileLineCount);
    });

    // Up
    let curDir = adbHelper.getCurDir();
    curDir = curDir.substr(0, curDir.length - 1);
    let pathDelimIdx = curDir.lastIndexOf('/');
    if (pathDelimIdx >= 0) {
        // Not root
        let parentDir = Utils.getParentDir(curDir);
        let lsUpDirCmd = CMD_LS_DIR + CMD_DELIMITER + parentDir;
        aBtnUp.attr('href', lsUpDirCmd).removeClass('disabled');
    } else {
        // Root
        aBtnUp.attr('href', '').addClass('disabled');
        let lsRootCmd = CMD_LS_DIR + CMD_DELIMITER + '/';
        aBtnRefresh.attr('href', lsRootCmd);
    }

    // Path bar
    let divToolbarPathContainer = divToolbarPath.find('#divToolbarPathContainer');
    divToolbarPathContainer.empty();
    let pathDirs = curDir.split('/');
    let pathPostfix = '/';
    for (let i = 0; i < pathDirs.length; ++i) {
        let pathDir = pathDirs[i].trim();
        pathDir = pathDir.trim();
        if (pathDir == '') {
            continue;
        }
        let pathDirHtml = pathDir + ' / ';
        pathDirHtml = Utils.escapeHtml(pathDirHtml);
        pathPostfix = pathPostfix + pathDir + '/';
        let lsPathCmd = CMD_LS_DIR + CMD_DELIMITER + pathPostfix;
        if (i < pathDirs.length - 1) {
            let aPathDirLink = $('<a/>').html(pathDirHtml).addClass('toolbarButton')
                .attr('href', lsPathCmd).on('click', function () {
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

function filterDirList(toFilter) {
    let divFileLines = divDirList.children('.fileLine');
    let filterCount = 0;
    if (toFilter == '') {
        divFileLines.removeClass('fileFilterOut');
        filterCount = divFileLines.length;
    } else {
        for (let i = 0; i < divFileLines.length; i++) {
            let divFileLine = $(divFileLines[i]);
            let divFileName = divFileLine.children('.fileName');
            let fileName = divFileName.attr('data-ref');
            fileName = fileName.toLowerCase();
            let toFilterLower = toFilter.toLowerCase();
            if (fileName.indexOf(toFilterLower) == -1) {
                divFileLine.addClass('fileFilterOut');
            } else {
                divFileLine.removeClass('fileFilterOut');
                filterCount++;
            }
        }
    }
    Utils.log('filterDirList, toFilter=[' + toFilter + '], filterCount=' + filterCount);
}

function selectDeviceAndRefreshRootDir(device) {
    adbHelper.setCurDevice(device);

    setCurrentDir('/');
    refreshDirList();

    // Enable buttons
    let lsRootCmd = CMD_LS_DIR + CMD_DELIMITER + '/';
    let lsAndroidCmd = CMD_LS_DIR + CMD_DELIMITER + '/sdcard/Android/';
    let lsSdcardCmd = CMD_LS_DIR + CMD_DELIMITER + '/sdcard/';
    let showHiddenCmd = CMD_SHOW_HIDDEN;
    let showTransferCmd = CMD_SHOW_TRANSFER;
    aBtnHiddenFile.attr('href', showHiddenCmd).removeClass('disabled');
    aBtnAndroid.attr('href', lsAndroidCmd).removeClass('disabled');
    aBtnSdcard.attr('href', lsSdcardCmd).removeClass('disabled');
    aBtnTransfer.attr('href', showTransferCmd).removeClass('disabled');
    aBtnRefresh.removeClass('disabled');

    // Path bar
    let divToolbarPathDevice = divToolbarPath.children('#divToolbarPathDevice');

    let aDeviceLink = $('<a/>').text(device).addClass('toolbarButton')
        .attr('href', CMD_SHOW_DEVICE).on('click', function () {
            return handleCmdClick($(this));
        });
    let aDeviceRootLink = $('<a/>').html('/&nbsp;').addClass('toolbarButton')
        .attr('href', lsRootCmd).on('click', function () {
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
    let modeText = (mode == 'pull') ? 'Pull' : 'Push';
    let fileName = Path.basename(path);
    let fileNameHtml = Utils.escapeHtml(fileName);
    let divTransferLine = $('<div/>').addClass('transferLine');
    let divFileName = $('<div/>').addClass('fileName').html(fileNameHtml);
    divTransferLine.append(divFileName);
    let divTransferProgress = $('<div/>').addClass('transferProgress').text(modeText + 'ing...');
    divTransferLine.append(divTransferProgress);
    let divTransferStop = $('<div/>').addClass('transferStop');
    divTransferLine.append(divTransferStop);
    let divNoTransfer = divTransferList.children('#divNoTransfer');
    divNoTransfer.hide();
    divNoTransfer.after(divTransferLine);

    const destPath = (mode == 'pull') ? downloadsDirPath : adbHelper.getCurDir();
    const transferId = adbHelper.transferFile(mode, path, destPath, (progressPercent) => {
        divTransferProgress.text(modeText + ': ' + progressPercent);
        updateTransferButton();
    }, (adbTransferResult) => {
        if (adbTransferResult.code == 0) {
            divTransferProgress.text(modeText + ': done' + adbTransferResult.message);
            divTransferStop.empty();
            if (mode == 'pull') {
                let pullPath = destPath + fileName;
                let showPullCmd = CMD_SHOW_PULL + CMD_DELIMITER + pullPath;
                let aShowPullLink = $('<a/>').attr('href', showPullCmd)
                    .on('click', function () {
                        return handleCmdClick($(this));
                    });
                let spanShowIcon = $('<span/>').addClass('materialIcons material-icons-round').text('search');
                aShowPullLink.append(spanShowIcon);
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
        fileNameHtml = Utils.escapeHtml(fileNameHtml);
        let toastMessage = modeText + ' "' + fileNameHtml + '" finished.';
        // showToast(toastMessage);
    });

    // Stop button
    let stopTransferCmd = CMD_STOP_TRANSFER + CMD_DELIMITER + transferId;
    let aStopTransferLink = $('<a/>').text('Stop').attr('href', stopTransferCmd)
        .on('click', function () {
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

    let cmd = '';
    if (cmdLink.is('[href]')) {
        cmd = cmdLink.attr('href');
    } else {
        cmd = cmdLink.attr('rel');
    }
    Utils.log('handleCmdClick=[' + cmd + ']');
    let delimiterIdx = cmd.indexOf(CMD_DELIMITER);
    let adbCmd = '';
    let adbCmdParam = '';
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
        setOnHideDialogCallback(function () {
            setOnHideDialogCallback(null);
            selectDeviceAndRefreshRootDir(device);
        });
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
        const aFileLink = cmdLink.find('a');
        aFileLink.trigger('click');
        break;
    case CMD_LS_DIR:
        let path = '';
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
    case CMD_FILTER_DIR:
        let filterVal = dirListFilter.getFilterVal();
        filterDirList(filterVal);
        break;
    case CMD_FILTER_DIR_CLEAR:
        filterDirList('');
        break;
    case CMD_WINDOW_MIN:
        remote.getCurrentWindow().minimize();
        break;
    case CMD_WINDOW_MAX:
        remote.getCurrentWindow().maximize();
        cmdLink.attr('href', CMD_WINDOW_RESTORE);
        cmdLink.children('img').attr('srcset', IMGSET_WINDOW_RESTORE);
        break;
    case CMD_WINDOW_RESTORE:
        remote.getCurrentWindow().unmaximize();
        cmdLink.attr('href', CMD_WINDOW_MAX);
        cmdLink.children('img').attr('srcset', IMGSET_WINDOW_MAX);
        break;
    case CMD_WINDOW_CLOSE:
        remote.getCurrentWindow().close();
        break;
    }
    return false;
}

$(function () {
    init();

    refreshDeviceAndShowDeviceDialog();
});
