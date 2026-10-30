const Utils = require('./utils');
// Bootstrap's transition helper. The .fade utility class only declares the
// opacity transition, so the box has to stay in the layout until the
// fade-out has finished.
const { executeAfterTransition } = require('bootstrap/js/dist/util/index.js');

class ListFilter {

    constructor(webContent) {
        this.webContent = webContent;

        this.filterBoxId = 'filterDivFilterBox';
        this.initiated = false;
        this.filterBoxShown = false;
        // Incremented on every open/close to detect a stale fade-out.
        this.fadeToken = 0;

        // find
        this.matchCase = false;
        this.findRequestId = null;
        this.lastStrToFind = '';
        this.lastMatchCase = null;

        // attr
        this.containerElem = $('body');
        this.filterButtonAttrs = null;
        this.filterHandler = null;
        this.closeButtonAttrs = null;
        this.closeHandler = null;

        this.divFilterBox = null;
        this.inputToFilter = null;
        this.aFilter = null;
        this.aClose = null;
    }

    setContainerElem(containerElem) {
        this.containerElem = containerElem;
    }

    getFilterVal() {
        return this.inputToFilter.val().trim();
    }

    setFilterButtonAttr(attrs) {
        this.filterButtonAttrs = attrs;
    }

    setFilterHandler(filterHandler) {
        this.filterHandler = filterHandler;
    }

    setCloseButtonAttr(attrs) {
        this.closeButtonAttrs = attrs;
    }

    setCloseHandler(closeHandler) {
        this.closeHandler = closeHandler;
    }

    initUI() {
        let that = this;

        if (this.initiated) {
            return;
        }
        this.initiated = true;

        this.divFilterBox = $('<div/>').attr('id', this.filterBoxId).addClass('filterBox fade');

        this.divFilterSearchBar = $('<div/>').addClass('filterSearchBar');

        this.divFilterSearchField = $('<div/>').addClass('filterSearchField');

        let spanSearchIcon = $('<span/>').addClass('materialIcons material-icons-round filterSearchIcon')
            .text('search');
        this.divFilterSearchField.append(spanSearchIcon);

        this.inputToFilter = $('<input/>').attr({
            'id': 'inputToFilter',
            'type': 'text',
            'placeholder': 'Find files',
            'autocomplete': 'off',
            'spellcheck': 'false'
        });
        this.inputToFilter.on('keydown', function (e) {
            if (e.code == 'Enter' || e.code == 'NumpadEnter') {
                that.aFilter.trigger('click');
            }
        });
        this.divFilterSearchField.append(this.inputToFilter);

        this.divFilterSearchBar.append(this.divFilterSearchField);

        this.aFilter = $('<a/>').attr('id', 'filterBtnFilter').text('Find');
        this.aFilter.addClass('filterButton').addClass('filterBtnTonal');
        this.aFilter.on('click', function () {
            if (that.filterHandler) {
                return that.filterHandler($(this));
            }
            return false;
        });
        if (this.filterButtonAttrs) {
            this.aFilter.attr(this.filterButtonAttrs);
        }
        this.divFilterSearchBar.append(this.aFilter);

        this.aClose = $('<a/>').attr('id', 'filterBtnClose').addClass('filterButton');
        this.aClose.addClass('filterBtnIcon').attr('title', 'Close');
        this.aClose.on('click', function () {
            that.closeFilterBox();
            return false;
        });
        let spanCloseIcon = $('<span/>').addClass('materialIcons material-icons-round').text('close');
        this.aClose.append(spanCloseIcon);
        if (this.closeButtonAttrs) {
            this.aClose.attr(this.closeButtonAttrs);
        }
        this.divFilterSearchBar.append(this.aClose);

        this.divFilterBox.append(this.divFilterSearchBar);

        this.containerElem.append(this.divFilterBox);

        $('body').on('keydown', function (e) {
            if (e.code == 'Escape') {
                that.closeFilterBox();
            }
        });
    }

    openFilterBox() {
        Utils.log('openFilterBox');
        this.initUI();
        // Cancel a pending fade-out, otherwise it would hide the box again.
        this.fadeToken++;
        let fadeToken = this.fadeToken;
        this.divFilterBox.addClass('filterShow');
        // Bootstrap's .fade animates opacity only. The browser has to paint
        // the box at opacity 0 before the .show class flips it to 1, so wait
        // for the next frame instead of forcing a reflow.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (fadeToken != this.fadeToken) {
                return;
            }
            this.divFilterBox.addClass('show');
        }));
        this.focusInput();
        this.filterBoxShown = true;
    }

    closeFilterBox() {
        if (!this.filterBoxShown) {
            return;
        }
        Utils.log('closeFilterBox');
        this.filterBoxShown = false;
        let fadeToken = ++this.fadeToken;
        if (!this.divFilterBox.hasClass('show')) {
            // The box never faded in, so there is nothing to transition.
            this.divFilterBox.removeClass('filterShow');
        } else {
            // Drop .show to fade the box out, then hide it once the
            // transition has finished.
            this.divFilterBox.removeClass('show');
            executeAfterTransition(() => {
                // Skip if the box was re-opened while fading out.
                if (fadeToken != this.fadeToken) {
                    return;
                }
                this.divFilterBox.removeClass('filterShow');
            }, this.divFilterBox[0]);
        }
        if (this.closeHandler) {
            this.closeHandler(this.aClose);
        }
    }

    focusInput() {
        this.inputToFilter.focus();
        this.inputToFilter[0].select();
    }
}

// exports
exports.ListFilter = ListFilter;
