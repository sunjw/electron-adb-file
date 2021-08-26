const Utils = require('./utils');

const nextIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/></svg>';
const closeIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>';

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
        this.availablePosition = ['topRight', 'topLeft', 'bottomLeft', 'bottomRight'];
        this.position = this.availablePosition[0];

        this.divFindBox = null;
        this.inputToFind = null;
        this.spanBtnFilter = null;
        this.spanBtnClose = null;
    }

    setFindBoxId(findBoxId) {
        this.findBoxId = findBoxId;
    }

    setContainerElem(containerElem) {
        this.containerElem = containerElem;
    }

    setPosition(position) {
        if (this.availablePosition.includes(position)) {
            this.position = position;
        }
    }

    initUI() {
        let that = this;

        if (this.initiated) {
            return;
        }
        this.initiated = true;

        this.divFindBox = $('<div/>').attr('id', this.findBoxId);
        this.divFindBox.addClass('filterFindBox');
        let positionClass = 'filter' + this.position[0].toUpperCase() + this.position.substring(1);
        this.divFindBox.addClass(positionClass);

        this.inputToFind = $('<input/>').attr('type', 'text');
        this.inputToFind.addClass('filterInputFind');
        this.inputToFind[0].onkeydown = function (e) {
            if (e.code == 'Enter') {
                that.findNext();
            }
        };
        this.divFindBox.append(this.inputToFind);

        this.spanBtnFilter = document.createElement('span');
        this.spanBtnFilter.innerHTML = nextIconSvg;
        this.spanBtnFilter.classList.add('filterButton', 'filterSvgButton', 'filterButtonNext');
        this.spanBtnFilter.onclick = function () {
            that.findNext();
        };
        this.divFindBox.append(this.spanBtnFilter);

        this.spanBtnClose = document.createElement('span');
        this.spanBtnClose.innerHTML = closeIconSvg;
        this.spanBtnClose.classList.add('filterButton', 'filterSvgButton', 'filterButtonClose');
        this.spanBtnClose.onclick = function () {
            that.closeFindBox();
        };
        this.divFindBox.append(this.spanBtnClose);

        this.containerElem.append(this.divFindBox);

        document.body.onkeydown = function (e) {
            if (e.code == 'Escape') {
                if (that.findBoxShown) {
                    that.closeFindBox();
                }
            }
        };
    }

    openFindBox() {
        this.initUI();
        this.divFindBox.addClass('filterShow');
        this.focusInput();
        this.findBoxShown = true;
    }

    closeFindBox() {
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
