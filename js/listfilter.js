const Utils = require('./utils');

const nextIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/></svg>';

class ListFilter {

    constructor(webContent) {
        this.webContent = webContent;

        this.findBoxId = 'filterDivFindBox';
        this.initiated = false;
        this.findBoxShown = false;
        this.matchCase = false;
        this.findRequestId = null;
        this.lastStrToFind = '';
        this.lastMatchCase = null;

        this.containerElem = $('body');

        this.divFindBox = null;
        this.inputToFind = null;
        this.aFilter = null;
        this.aClose = null;
    }

    setFindBoxId(findBoxId) {
        this.findBoxId = findBoxId;
    }

    setContainerElem(containerElem) {
        this.containerElem = containerElem;
    }

    initUI() {
        let that = this;

        if (this.initiated) {
            return;
        }
        this.initiated = true;

        this.divFindBox = $('<div/>').attr('id', this.findBoxId).addClass('filterFindBox');

        this.inputToFind = $('<input/>').attr('type', 'text').addClass('filterInputFind');
        this.inputToFind[0].onkeydown = function (e) {
            if (e.code == 'Enter') {
                that.findNext();
            }
        };
        this.divFindBox.append(this.inputToFind);

        this.aFilter = $('<a/>').attr('id', 'filterBtnFilter').text('Filter');
        this.aFilter.addClass('filterButton');
        this.aFilter.on('click', function () {
            that.findNext();
            return false;
        });
        this.divFindBox.append(this.aFilter);

        this.aClose = $('<a/>').attr('id', 'filterBtnClose').addClass('filterButton');
        this.aClose.on('click', function () {
            that.closeFindBox();
            return false;
        });
        let spanCloseIcon = $('<span/>').addClass('material-icons-round').text('close');
        this.aClose.append(spanCloseIcon);
        this.divFindBox.append(this.aClose);

        this.containerElem.append(this.divFindBox);

        $('body').on('keydown', function (e) {
            if (e.code == 'Escape') {
                that.closeFindBox();
            }
        });
    }

    openFindBox() {
        this.initUI();
        this.divFindBox.addClass('filterShow');
        this.focusInput();
        this.findBoxShown = true;
    }

    closeFindBox() {
        if (!this.findBoxShown) {
            return;
        }
        this.divFindBox.removeClass('filterShow');
        this.stopFind();
        this.findBoxShown = false;
    }

    focusInput() {
        this.inputToFind.focus();
        this.inputToFind[0].select();
    }

    stopFind() {
        if (this.findRequestId == null) {
            return;
        }
        this.webContent.stopFindInPage('clearSelection');
        this.findRequestId = null;
    }

    findInternal(isForward) {
        const invisibleChar = '\u2028'; // Tricky for avoid Electron find in input.
        let strToFind = this.inputToFind.val();
        let strMatchCase = this.matchCase;

        if (strToFind.length == 0) {
            return;
        }

        let strToFindBackup = strToFind.slice();
        let strToFindTweak = strToFind.substring(0, 1) + invisibleChar + strToFind.substring(1);
        this.inputToFind.val(strToFindTweak);
        if (strToFind != this.lastStrToFind) {
            this.stopFind(); // restart
        }
        if (this.lastMatchCase == null || this.lastMatchCase != strMatchCase) {
            this.stopFind(); // restart
        }
        if (this.findRequestId != null) {
            this.webContent.findInPage(strToFind, {
                forward: isForward,
                findNext: true,
                matchCase: strMatchCase
            });
        } else {
            this.findRequestId = this.webContent.findInPage(strToFind, {
                forward: true,
                findNext: false,
                matchCase: strMatchCase
            });
        }
        this.lastStrToFind = strToFind;
        this.lastMatchCase = strMatchCase;
        setTimeout(() => {
            this.inputToFind.val(strToFindBackup);
        }, 100);
    }

    findNext() {
        this.findInternal(true);
    }

    findPrev() {
        this.findInternal(false);
    }
}

// exports
exports.ListFilter = ListFilter;
