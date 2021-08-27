const Utils = require('./utils');

class ListFilter {

    constructor(webContent) {
        this.webContent = webContent;

        this.filterBoxId = 'filterDivFilterBox';
        this.initiated = false;
        this.filterBoxShown = false;
        this.matchCase = false;
        this.findRequestId = null;
        this.lastStrToFind = '';
        this.lastMatchCase = null;

        this.containerElem = $('body');

        this.divFindBox = null;
        this.inputToFilter = null;
        this.aFilter = null;
        this.aClose = null;
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

        this.divFindBox = $('<div/>').attr('id', this.filterBoxId).addClass('filterBox');

        this.inputToFilter = $('<input/>').attr({
            'id': 'inputToFilter',
            'type': 'text'
        });
        this.inputToFilter.on('keydown', function (e) {
            if (e.code == 'Enter' || e.code == 'NumpadEnter') {
                that.findNext();
            }
        });
        this.divFindBox.append(this.inputToFilter);

        this.aFilter = $('<a/>').attr('id', 'filterBtnFilter').text('Filter');
        this.aFilter.addClass('filterButton');
        this.aFilter.on('click', function () {
            that.findNext();
            return false;
        });
        this.divFindBox.append(this.aFilter);

        this.aClose = $('<a/>').attr('id', 'filterBtnClose').addClass('filterButton');
        this.aClose.on('click', function () {
            that.closeFilterBox();
            return false;
        });
        let spanCloseIcon = $('<span/>').addClass('material-icons-round').text('close');
        this.aClose.append(spanCloseIcon);
        this.divFindBox.append(this.aClose);

        this.containerElem.append(this.divFindBox);

        $('body').on('keydown', function (e) {
            if (e.code == 'Escape') {
                that.closeFilterBox();
            }
        });
    }

    openFilterBox() {
        this.initUI();
        this.divFindBox.addClass('filterShow');
        this.focusInput();
        this.filterBoxShown = true;
        Utils.log('openFilterBox');
    }

    closeFilterBox() {
        if (!this.filterBoxShown) {
            return;
        }
        this.divFindBox.removeClass('filterShow');
        this.stopFind();
        this.filterBoxShown = false;
        Utils.log('closeFilterBox');
    }

    focusInput() {
        this.inputToFilter.focus();
        this.inputToFilter[0].select();
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
        let strToFind = this.inputToFilter.val();
        let strMatchCase = this.matchCase;

        if (strToFind.length == 0) {
            return;
        }

        let strToFindBackup = strToFind.slice();
        let strToFindTweak = strToFind.substring(0, 1) + invisibleChar + strToFind.substring(1);
        this.inputToFilter.val(strToFindTweak);
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
            this.inputToFilter.val(strToFindBackup);
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
