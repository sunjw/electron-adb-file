const Utils = require('./utils');

class ListFilter {

    constructor(webContent) {
        this.webContent = webContent;

        this.filterBoxId = 'filterDivFilterBox';
        this.initiated = false;
        this.filterBoxShown = false;

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

        this.divFilterBox = $('<div/>').attr('id', this.filterBoxId).addClass('filterBox');

        this.divFilterSearchBar = $('<div/>').addClass('filterSearchBar');

        this.divFilterSearchField = $('<div/>').addClass('filterSearchField');

        let spanSearchIcon = $('<span/>').addClass('materialIcons material-icons-round filterSearchIcon')
            .text('search');
        this.divFilterSearchField.append(spanSearchIcon);

        this.inputToFilter = $('<input/>').attr({
            'id': 'inputToFilter',
            'type': 'text',
            'placeholder': 'Filter files',
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

        this.aFilter = $('<a/>').attr('id', 'filterBtnFilter').text('Filter');
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
        this.divFilterBox.addClass('filterShow');
        this.focusInput();
        this.filterBoxShown = true;
    }

    closeFilterBox() {
        if (!this.filterBoxShown) {
            return;
        }
        Utils.log('closeFilterBox');
        this.divFilterBox.removeClass('filterShow');
        this.filterBoxShown = false;
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
