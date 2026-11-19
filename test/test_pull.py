"""Pulling a file from the phone.

The app pulls a file when it is clicked in the file list, and puts it into
the download directory of the operating system.  Only the file that the
upload suite put on the phone is pulled, and it is checked against the file
that was uploaded: the two have to be the same, byte for byte.

The download directory is left alone otherwise.  A file that is already
there under the same name is not overwritten.
"""

import os

import fixtures
from base import Suite, expect_contains, expect_eq, expect_true

suite = Suite('pull')


def _prepare(app):
    """Put the package on the phone and open the scratch directory.

    The file that is pulled is the one the upload suite puts on the phone,
    so it is uploaded here as well, which also makes the pull suite work on
    its own.
    """
    fixtures.open_temp_dir(app)
    fixtures.push_package(app)


@suite.case('a file on the phone can be pulled')
def _(app):
    _prepare(app)

    row = fixtures.pull_package(app)
    expect_contains(row['progress'], 'done',
                    'the pull did not report success: %r' % row['progress'])


@suite.case('the pulled file lands in the download directory')
def _(app):
    _prepare(app)
    name = fixtures.package_name()

    fixtures.pull_package(app)

    # The app writes the file into the download directory of the system.
    downloaded = os.path.join(fixtures.paths.downloads_dir(), name)
    expect_true(os.path.isfile(downloaded),
                'the pulled file is not in the download directory: %r' % downloaded)
    expect_true(os.path.getsize(downloaded) > 0,
                'the pulled file is empty')


@suite.case('the pulled file is the same as the uploaded file')
def _(app):
    _prepare(app)
    name = fixtures.package_name()

    fixtures.pull_package(app)

    source = fixtures.local_package()
    downloaded = os.path.join(fixtures.paths.downloads_dir(), name)

    expect_true(os.path.isfile(downloaded),
                'the pulled file is not in the download directory: %r' % downloaded)

    # The app reports the download as done when the transfer ends, but the
    # file is written through a stream that flushes on its own, so the
    # comparison waits for the file to be complete.
    fixtures.wait_for_download(downloaded, os.path.getsize(source))

    expect_eq(os.path.getsize(downloaded), os.path.getsize(source),
              'the pulled file has a different size than the uploaded one')

    # The size can match while the content differs, so compare the content.
    expect_eq(fixtures.file_digest(downloaded), fixtures.file_digest(source),
              'the pulled file is not the same as the uploaded one')


@suite.case('the transfer list shows the finished pull')
def _(app):
    _prepare(app)
    name = fixtures.package_name()

    row = fixtures.pull_package(app)

    expect_eq(row['name'], name,
              'the transfer list shows the wrong file name')
    expect_true(row['finished'],
                'the transfer was not marked as finished')
    expect_contains(row['progress'], 'Pull',
                    'the transfer list does not say that this was a download')
