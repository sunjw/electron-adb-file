"""Browsing the directories of the phone."""

import adb
import paths
from base import (BTN_BACK, BTN_HIDDEN, BTN_REFRESH, BTN_SDCARD,
                  Suite, expect_contains, expect_eq, expect_true)

suite = Suite('directory')

# Directories that a phone normally has below /sdcard.  The suite picks one
# of the ones the connected phone actually has.
KNOWN_SUBDIRS = ('Download', 'Android', 'DCIM', 'Pictures')


def _known_subdir(device_id):
    """The names of the known directories that exist on the phone."""
    entries = adb.list_remote(device_id, '/sdcard')
    return [name for name in entries if name in KNOWN_SUBDIRS]


def _open_sdcard(app):
    """Select the phone and open /sdcard/ with the SDCARD button.

    `select_device` already waits for the root listing, so the mark is taken
    after it and only covers the SDCARD listing.
    """
    app.select_device()
    mark = app.listing_mark()
    app.click(BTN_SDCARD)
    app.wait_for_listing(mark)
    app.wait_for_path('sdcard')


def _open_subdir(app, name):
    """Open a subdirectory of the current one and wait for its rows."""
    mark = app.listing_mark()
    app.click_dir_entry(name)
    app.wait_for_listing(mark)
    app.wait_for_path(name)


@suite.case('the SDCARD button opens the sdcard root')
def _(app):
    app.select_device()
    mark = app.listing_mark()
    app.click(BTN_SDCARD)
    app.wait_for_listing(mark)
    app.wait_for_path('sdcard')

    names = app.dir_names()
    expect_contains(names, 'Download', 'the sdcard listing has no Download entry')


@suite.case('the path bar shows the directory that is open')
def _(app):
    _open_sdcard(app)
    expect_contains(app.path_text(), 'sdcard',
                    'the path bar does not show the sdcard directory')


@suite.case('clicking a directory opens it')
def _(app):
    _open_sdcard(app)

    # Pick a directory the phone actually has.
    device_id = adb.require_device()
    directories = _known_subdir(device_id)
    expect_true(directories, 'the sdcard directory has no known subdirectory')

    _open_subdir(app, directories[0])
    expect_contains(app.path_text(), directories[0],
                    'the path bar does not show the directory that was opened')
    expect_true(directories[0] not in app.dir_names(),
                'the listing still shows the directory that was opened')


@suite.case('the scratch directory on the phone can be opened')
def _(app):
    device_id = adb.require_device()
    adb.ensure_temp_dir(device_id)

    _open_sdcard(app)
    _open_subdir(app, 'Download')
    _open_subdir(app, 'temp')

    # The listing must match what adb reports for the same directory.
    listed = app.dir_names()
    expected = adb.list_remote(device_id, paths.DEVICE_TEMP_DIR)
    for name in expected:
        expect_contains(listed, name,
                        'the file list is missing %r' % name)


@suite.case('a file row shows a size and a modification date')
def _(app):
    _open_sdcard(app)

    entries = app.dir_entries()
    expect_true(entries, 'the sdcard listing is empty')

    for entry in entries:
        if entry['isDir']:
            expect_eq(entry['size'], 'Folder', 'a directory row has a wrong size')
        else:
            expect_true(entry['size'].endswith('B'),
                        'a file row has no size: %r' % entry['size'])
        expect_true(entry['modified'], 'a row has no modification date')


@suite.case('the back button returns to the parent directory')
def _(app):
    _open_sdcard(app)

    device_id = adb.require_device()
    directories = _known_subdir(device_id)
    expect_true(directories, 'the sdcard directory has no known subdirectory')

    _open_subdir(app, directories[0])

    mark = app.listing_mark()
    app.click(BTN_BACK)
    app.wait_for_listing(mark)
    app.wait_for_path('sdcard')

    names = app.dir_names()
    expect_true(any(name in names for name in KNOWN_SUBDIRS),
                'the parent directory was not restored')


@suite.case('the refresh button lists the directory again')
def _(app):
    _open_sdcard(app)

    before = app.dir_names()
    mark = app.listing_mark()
    app.click(BTN_REFRESH)
    app.wait_for_listing(mark)
    app.wait_for_path('sdcard')

    after = app.dir_names()
    expect_eq(after, before, 'refreshing changed the directory listing')


@suite.case('the hidden file toggle changes the button and reloads the list')
def _(app):
    _open_sdcard(app)

    expect_eq(app.text(BTN_HIDDEN).strip(), 'Show Hidden',
              'unexpected label of the hidden file button')

    mark = app.listing_mark()
    app.click(BTN_HIDDEN)
    app.wait_for_listing(mark)
    app.wait_for_path('sdcard')
    expect_eq(app.text(BTN_HIDDEN).strip(), 'Hide Hidden',
              'the hidden file button did not change its label')

    mark = app.listing_mark()
    app.click(BTN_HIDDEN)
    app.wait_for_listing(mark)
    app.wait_for_path('sdcard')
    expect_eq(app.text(BTN_HIDDEN).strip(), 'Show Hidden',
              'the hidden file button did not change its label back')
