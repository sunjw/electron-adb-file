"""Uploading a file to the phone.

The app uploads by drag and drop: the file is dropped onto the file list and
is then sent to the directory that is currently open.  Every upload in this
suite therefore happens in `/sdcard/Download/temp`, the scratch directory on
the phone, and the payload is a package from `dist/`.

The package keeps its own name, so a run overwrites the upload of the
previous run instead of leaving another copy behind.  Nothing is deleted on
the phone or on the computer; the files are left in place for the user to
clean up.
"""

import os

import adb
import paths
from base import (BTN_SDCARD, Suite, expect_contains, expect_eq, expect_true)

suite = Suite('upload')

# Uploading a package takes a while over USB, so the transfer gets more time
# than the directory listings.
TRANSFER_TIMEOUT_MS = 600000


def _open_temp_dir(app):
    """Open /sdcard/Download/temp in the app.

    The upload goes to the directory that is open, so the app has to be
    there before the file is dropped.
    """
    device_id = adb.require_device()
    adb.ensure_temp_dir(device_id)

    app.select_device()
    mark = app.listing_mark()
    app.click(BTN_SDCARD)
    app.wait_for_listing(mark)
    app.wait_for_path('sdcard')

    app.open_dir('Download/temp')
    app.wait_for_path('temp')
    return device_id


def _local_package():
    """The package from dist/ that is used as the upload payload.

    The package is uploaded under its own name, so every run overwrites the
    previous upload on the phone instead of piling up copies of the same
    file under different names.
    """
    package = paths.dist_package()
    if package is None:
        raise AssertionError('no package in dist/ to upload')
    return package


@suite.case('a package from dist/ can be uploaded to the phone')
def _(app):
    device_id = _open_temp_dir(app)
    local = _local_package()
    name = os.path.basename(local)
    expected_size = os.path.getsize(local)

    app.drop_file(local)

    row = app.wait_for_transfer(name, timeout=TRANSFER_TIMEOUT_MS)
    expect_contains(row['progress'], 'done',
                    'the upload did not report success: %r' % row['progress'])

    # The file has to be on the phone, with the size it has locally.
    remote_path = paths.DEVICE_TEMP_DIR + '/' + name
    size = adb.remote_size(device_id, remote_path)
    expect_true(size is not None,
                'the uploaded file is not on the phone at %r' % remote_path)
    expect_eq(size, expected_size,
              'the uploaded file has the wrong size on the phone')


@suite.case('an uploaded file shows up in the file list')
def _(app):
    device_id = _open_temp_dir(app)
    local = _local_package()
    name = os.path.basename(local)

    app.drop_file(local)
    app.wait_for_transfer(name, timeout=TRANSFER_TIMEOUT_MS)

    # The app reloads the directory after an upload, so the new file has to
    # be in the list.
    app.wait_until(
        """name => {
             const rows = [...document.querySelectorAll('#divDirList .fileLine')];
             return rows.some(row => {
                 const el = row.querySelector('.fileName');
                 return el && el.getAttribute('data-ref') === name;
             });
           }""",
        arg=name, timeout=30000,
        what='the uploaded file %r to show up in the file list' % name)


@suite.case('an uploaded file keeps its name on the phone')
def _(app):
    device_id = _open_temp_dir(app)
    local = _local_package()
    name = os.path.basename(local)

    app.drop_file(local)
    app.wait_for_transfer(name, timeout=TRANSFER_TIMEOUT_MS)

    entries = adb.list_remote(device_id, paths.DEVICE_TEMP_DIR)
    expect_contains(entries, name,
                    'the uploaded file is missing on the phone')


@suite.case('the transfer list shows the finished upload')
def _(app):
    _open_temp_dir(app)
    local = _local_package()
    name = os.path.basename(local)

    app.drop_file(local)
    row = app.wait_for_transfer(name, timeout=TRANSFER_TIMEOUT_MS)

    expect_eq(row['name'], name,
              'the transfer list shows the wrong file name')
    expect_true(row['finished'],
                'the transfer was not marked as finished')
    expect_contains(row['progress'], 'Push',
                    'the transfer list does not say that this was an upload')
