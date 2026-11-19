"""Shared fixtures for the transfer tests.

Both the upload and the pull suite work with the same file: a package from
`dist/` that is put on the phone in `/sdcard/Download/temp`, and that the
pull suite then fetches back.  The helpers here set that up, so the two
suites cannot drift apart.
"""

import hashlib
import os
import time

import adb
import paths
from base import BTN_SDCARD

# Uploading a package takes a while over USB, so a transfer gets more time
# than a directory listing.
TRANSFER_TIMEOUT_MS = 600000

# The slowest transfer that is still considered healthy, in bytes per second.
#
# The app only reports a speed once a transfer has run for two seconds
# (SPEED_START_INTERVAL in js/adbHelper.js), and a package over a healthy
# USB connection is done in well under that, so the app usually reports no
# speed at all.  The suite therefore measures the throughput itself and
# compares it against this limit.
#
# A package of about 100 MB moves at 100-130 MB/s over USB on a healthy
# setup, so 50 MB/s leaves room for a busy machine while still catching a
# connection that cannot keep up.
MIN_TRANSFER_SPEED = 50 * 1024 * 1024


def open_temp_dir(app):
    """Open /sdcard/Download/temp in the app.

    The upload goes to the directory that is open, so the app has to be
    there before a file is dropped.
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


def local_package():
    """The package from dist/ that is used as the transfer payload.

    The package keeps its own name, so a run overwrites the upload of the
    previous run instead of leaving another copy behind.
    """
    package = paths.dist_package()
    if package is None:
        raise AssertionError('no package in dist/ to transfer')
    return package


def package_name():
    """The name of the payload, which is also its name on the phone."""
    return os.path.basename(local_package())


def push_package(app, timeout=TRANSFER_TIMEOUT_MS):
    """Upload the package to the phone and wait for it to finish.

    Returns the transfer row of the upload, with the measured speed added
    to it.
    """
    package = local_package()
    name = os.path.basename(package)
    size = os.path.getsize(package)

    app.transfer_mark()
    started = time.time()
    app.drop_file(package)
    row = app.wait_for_transfer(name, timeout=timeout, only_new=True)
    elapsed = time.time() - started

    row['seconds'] = elapsed
    row['bytes'] = size
    row['speed'] = size / elapsed if elapsed > 0 else 0
    return row


def pull_package(app, timeout=TRANSFER_TIMEOUT_MS):
    """Pull the package from the phone and wait for it to finish.

    Clicking a file in the file list is what starts a download, so the file
    is pulled the way a person would pull it.  The transfer list holds the
    upload of the same file as well, so only the row that is new is looked
    at.

    Returns the transfer row of the pull, with the measured speed added to
    it.
    """
    name = package_name()
    check_pull_target(name)
    size = os.path.getsize(local_package())

    app.transfer_mark()
    started = time.time()
    app.click_file_entry(name)
    row = app.wait_for_transfer(name, timeout=timeout, only_new=True)
    elapsed = time.time() - started

    row['seconds'] = elapsed
    row['bytes'] = size
    row['speed'] = size / elapsed if elapsed > 0 else 0
    return row



def downloaded_file(name):
    """The path of a file the app pulled into the download directory."""
    return os.path.join(paths.downloads_dir(), name)


def wait_for_download(path, size, timeout=TRANSFER_TIMEOUT_MS):
    """Wait until the downloaded file has the expected size.

    The app reports a download as done when the read side of the transfer
    ends, but the file is written through a stream that flushes on its own,
    so the file can still be a moment behind when the app says it is done.
    """
    deadline = time.time() + timeout / 1000.0
    while time.time() < deadline:
        if os.path.exists(path) and os.path.getsize(path) == size:
            return
        time.sleep(0.2)
    raise AssertionError('the downloaded file %r did not reach its size within %dms'
                         % (path, timeout))


def check_pull_target(name):
    """Make sure pulling will not destroy a file that belongs to the user.

    The app names the downloaded file after the file on the phone, so it
    always writes to the same path in the download directory.  A file that
    is already there is only overwritten when it is one of our own: either
    the download of an earlier run of this suite, or the remains of a run
    that was cut short.  Anything else is the user's file and stops the
    pull.
    """
    source = local_package()
    target = downloaded_file(name)

    if not os.path.exists(target):
        return

    source_size = os.path.getsize(source)
    target_size = os.path.getsize(target)

    if target_size < source_size:
        # The remains of a run that was cut short.
        return

    if target_size == source_size and file_digest(target) == file_digest(source):
        # The download of an earlier run of this suite.
        return

    raise AssertionError(
        'the download directory already holds a different file named %r '
        '(size %d, expected %d). Move it aside and run the suite again, so '
        'the pull does not overwrite it.' % (name, target_size, source_size))


def file_digest(path):
    """The SHA-256 digest of a file, read in blocks."""
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def format_speed(speed):
    """A speed in bytes per second, as a readable string."""
    if speed >= 1024 * 1024:
        return '%.1f MB/s' % (speed / (1024.0 * 1024.0))
    if speed >= 1024:
        return '%.1f KB/s' % (speed / 1024.0)
    return '%.0f B/s' % speed


def expect_fast_transfer(row, what):
    """Fail the case when a transfer was too slow.

    The app only reports a speed once a transfer has run for two seconds,
    so the throughput is measured here instead: the size of the file over
    the time the transfer took.
    """
    speed = row.get('speed', 0)
    if speed < MIN_TRANSFER_SPEED:
        raise AssertionError(
            'the %s was too slow: %s (%s in %.1fs), the limit is %s'
            % (what, format_speed(speed),
               format_speed(row.get('bytes', 0)) + ' moved',
               row.get('seconds', 0), format_speed(MIN_TRANSFER_SPEED)))
    return speed

