const matchCaseIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m2.244 13.081.943-2.803H6.66l.944 2.803H8.86L5.54 3.75H4.322L1 13.081h1.244zm2.7-7.923L6.34 9.314H3.51l1.4-4.156h.034zm9.146 7.027h.035v.896h1.128V8.125c0-1.51-1.114-2.345-2.646-2.345-1.736 0-2.59.916-2.666 2.174h1.108c.068-.718.595-1.19 1.517-1.19.971 0 1.518.52 1.518 1.464v.731H12.19c-1.647.007-2.522.8-2.522 2.058 0 1.319.957 2.18 2.345 2.18 1.06 0 1.716-.43 2.078-1.011zm-1.763.035c-.752 0-1.456-.397-1.456-1.244 0-.65.424-1.115 1.408-1.115h1.805v.834c0 .896-.752 1.525-1.757 1.525z"/></svg>';
const prevIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/></svg>';
const nextIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/></svg>';
const closeIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>';

class ElectronFindInContent {

    constructor(webContent) {
        this.webContent = webContent;

        this.findBoxId = 'ficDivFindBox';
        this.initiated = false;
        this.findBoxShown = false;
        this.matchCase = false;
        this.findRequestId = null;
        this.lastStrToFind = '';
        this.lastMatchCase = null;

        this.containerElem = document.body;
        this.availablePosition = ['topRight', 'topLeft', 'bottomLeft', 'bottomRight'];
        this.position = this.availablePosition[0];

        this.divFindBox = null;
        this.inputToFind = null;
        this.spanMatchCount = null;
        this.spanMatchCase = null;
        this.spanFindPrev = null;
        this.spanFindNext = null;
        this.spanClose = null;
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

        this.divFindBox = document.createElement('div');
        this.divFindBox.id = this.findBoxId;
        this.divFindBox.classList.add('ficFindBox');
        let positionClass = 'fic' + this.position[0].toUpperCase() + this.position.substring(1);
        this.divFindBox.classList.add(positionClass);

        this.inputToFind = document.createElement('input');
        this.inputToFind.setAttribute('type', 'text');
        this.inputToFind.classList.add('ficToFind');
        this.inputToFind.onkeydown = function (e) {
            if (e.code == 'Enter') {
                that.findNext();
            }
        };
        this.divFindBox.appendChild(this.inputToFind);

        this.spanMatchCount = document.createElement('span');
        this.spanMatchCount.innerHTML = '0/0';
        this.spanMatchCount.classList.add('ficMatchCount');
        this.divFindBox.appendChild(this.spanMatchCount);

        this.spanMatchCase = document.createElement('span');
        this.spanMatchCase.innerHTML = matchCaseIconSvg;
        this.spanMatchCase.classList.add('ficButton', 'ficSvgButton', 'ficButtonMatchCase');
        this.spanMatchCase.onclick = function () {
            that.matchCase = !that.matchCase;
            if (that.matchCase) {
                that.spanMatchCase.classList.add('ficButtonActive');
            } else {
                that.spanMatchCase.classList.remove('ficButtonActive');
            }
            that.findNext();
        };
        this.divFindBox.appendChild(this.spanMatchCase);

        this.spanFindPrev = document.createElement('span');
        this.spanFindPrev.innerHTML = prevIconSvg;
        this.spanFindPrev.classList.add('ficButton', 'ficSvgButton', 'ficButtonPrev');
        this.spanFindPrev.onclick = function () {
            that.findPrev();
        };
        this.divFindBox.appendChild(this.spanFindPrev);

        this.spanFindNext = document.createElement('span');
        this.spanFindNext.innerHTML = nextIconSvg;
        this.spanFindNext.classList.add('ficButton', 'ficSvgButton', 'ficButtonNext');
        this.spanFindNext.onclick = function () {
            that.findNext();
        };
        this.divFindBox.appendChild(this.spanFindNext);

        this.spanClose = document.createElement('span');
        this.spanClose.innerHTML = closeIconSvg;
        this.spanClose.classList.add('ficButton', 'ficSvgButton', 'ficButtonClose');
        this.spanClose.onclick = function () {
            that.closeFindBox();
        };
        this.divFindBox.appendChild(this.spanClose);

        this.containerElem.appendChild(this.divFindBox);

        document.body.onkeydown = function (e) {
            if (e.code == 'Escape') {
                if (that.findBoxShown) {
                    that.closeFindBox();
                }
            }
        };

        this.webContent.on('found-in-page', (e, r) => {
            that.updateMatchCount(r);
        });
    }

    openFindBox() {
        this.initUI();
        this.divFindBox.classList.add('ficShow');
        this.focusInput();
        this.findBoxShown = true;
    }

    closeFindBox() {
        this.divFindBox.classList.remove('ficShow');
        this.stopFind();
        this.findBoxShown = false;
    }

    focusInput() {
        this.inputToFind.focus();
        this.inputToFind.select(0);
    }

    stopFind() {
        if (this.findRequestId == null) {
            return;
        }
        this.webContent.stopFindInPage('clearSelection');
        this.findRequestId = null;
        this.clearMatchCount();
    }

    findInternal(isForward) {
        const invisibleChar = '\u2028'; // Tricky for avoid Electron find in input.
        let strToFind = this.inputToFind.value;
        let strMatchCase = this.matchCase;

        if (strToFind.length == 0) {
            return;
        }

        let strToFindBackup = strToFind.slice();
        let strToFindTweak = strToFind.substring(0, 1) + invisibleChar + strToFind.substring(1);
        this.inputToFind.value = strToFindTweak;
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
            this.inputToFind.value = strToFindBackup;
        }, 100);
    }

    findNext() {
        this.findInternal(true);
    }

    findPrev() {
        this.findInternal(false);
    }

    updateMatchCount(result) {
        let cur = result.activeMatchOrdinal;
        let total = result.matches;
        this.spanMatchCount.innerHTML = cur + '/' + total;
    }

    clearMatchCount() {
        this.spanMatchCount.innerHTML = '0/0';
    }
}

// exports
exports.ElectronFindInContent = ElectronFindInContent;
