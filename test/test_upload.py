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
import fixtures
import paths
from base import Suite, expect_contains, expect_eq, expect_true

suite = Suite('upload')


@suite.case('a package from dist/ can be uploaded to the phone')
def _(app):
    device_id = fixtures.open_temp_dir(app)
    local = fixtures.local_package()
    expected_size = os.path.getsize(local)

    row = fixtures.push_package(app)
    expect_contains(row['progress'], 'done',
                    'the upload did not report success: %r' % row['progress'])

    # The file has to be on the phone, with the size it has locally.
    remote_path = paths.DEVICE_TEMP_DIR + '/' + fixtures.package_name()
    size = adb.remote_size(device_id, remote_path)
    expect_true(size is not None,
                'the uploaded file is not on the phone at %r' % remote_path)
    expect_eq(size, expected_size,
              'the uploaded file has the wrong size on the phone')


@suite.case('an uploaded file shows up in the file list')
def _(app):
    fixtures.open_temp_dir(app)
    name = fixtures.package_name()

    fixtures.push_package(app)

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
    device_id = fixtures.open_temp_dir(app)

    fixtures.push_package(app)

    entries = adb.list_remote(device_id, paths.DEVICE_TEMP_DIR)
    expect_contains(entries, fixtures.package_name(),
                    'the uploaded file is missing on the phone')


@suite.case('the transfer list shows the finished upload')
def _(app):
    fixtures.open_temp_dir(app)
    name = fixtures.package_name()

    row = fixtures.push_package(app)

    expect_eq(row['name'], name,
              'the transfer list shows the wrong file name')
    expect_true(row['finished'],
                'the transfer was not marked as finished')
    expect_contains(row['progress'], 'Push',
                    'the transfer list does not say that this was an upload')
