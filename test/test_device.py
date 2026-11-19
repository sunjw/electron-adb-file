"""Device list and device selection."""

import adb
from base import (DEVICE_LINE, DIALOG_TITLE, DIR_LINE, PATH_DEVICE,
                  BTN_ANDROID, BTN_SDCARD, BTN_REFRESH, Suite,
                  expect_contains, expect_eq, expect_true)

suite = Suite('device')


@suite.case('the device dialog lists the connected phone')
def _(app):
    ids = app.device_ids()
    expect_true(ids, 'the device dialog lists no device')

    statuses = app.device_statuses()
    expect_eq(len(statuses), len(ids), 'a device has no status line')
    for status in statuses:
        expect_contains(status, 'Status:', 'unexpected device status line')

    # The app must show the same phone the adb command line sees.
    known = [identifier for identifier, _ in adb.list_devices()]
    for identifier in ids:
        expect_contains(known, identifier,
                        'the app shows a phone that adb does not know')


@suite.case('the device dialog is titled "Devices"')
def _(app):
    expect_eq(app.text(DIALOG_TITLE).strip(), 'Devices',
              'unexpected device dialog title')


@suite.case('selecting a device enables the toolbar')
def _(app):
    expect_true(app.is_disabled(BTN_REFRESH),
                'the refresh button should be disabled before a device is chosen')
    expect_true(app.is_disabled(BTN_SDCARD),
                'the SDCARD button should be disabled before a device is chosen')

    app.select_device()

    expect_true(not app.is_disabled(BTN_REFRESH),
                'the refresh button should be enabled after a device is chosen')
    expect_true(not app.is_disabled(BTN_SDCARD),
                'the SDCARD button should be enabled after a device is chosen')
    expect_true(not app.is_disabled(BTN_ANDROID),
                'the Android button should be enabled after a device is chosen')


@suite.case('selecting a device shows it in the path bar')
def _(app):
    device_id = app.select_device()
    expect_eq(app.current_device(), device_id,
              'the path bar does not show the selected device')
    expect_contains(app.text(PATH_DEVICE) or '', device_id,
                    'the selected device is missing from the path bar')


@suite.case('selecting a device loads the root directory')
def _(app):
    app.select_device()
    # The root of the phone holds the well known top level directories.
    app.wait_ready(DIR_LINE)
    names = app.dir_names()
    expect_true('sdcard' in names,
                'the root listing has no sdcard entry: %r' % names)


@suite.case('the device dialog can be reopened')
def _(app):
    app.select_device()

    # The device link in the path bar opens the dialog again.
    app.page.locator('#divToolbarPathDevice a').first.click()
    app.wait_ready(DEVICE_LINE)
    expect_eq(app.text(DIALOG_TITLE).strip(), 'Devices',
              'the device dialog did not reopen')
    expect_true(app.device_ids(), 'the reopened device dialog lists no device')
