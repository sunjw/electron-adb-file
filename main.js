const fs = require('fs');
const path = require('path');

// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain } = require('electron')

const electronLocalshortcut = require('electron-localshortcut')
const windowStateKeeper = require('electron-window-state')

const utils = require('./js/utils.js')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let transferCount = 0

function createWindow() {
  // Load the previous state with fallback to defaults
  let mainWindowState = windowStateKeeper({
    defaultWidth: 900,
    defaultHeight: 600
  })

  // Create the browser window.
  var titleBarStyleOS = 'default'
  if (utils.isMacOS()) {
    titleBarStyleOS = 'hiddenInset'
  }
  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: titleBarStyleOS,
    webPreferences: {
      nodeIntegration: true
    }
  })

  if (mainWindowState.isMaximized) {
    mainWindow.maximize()
  }
  if (mainWindowState.isFullScreen) {
    mainWindow.setFullScreen(true)
  }

  mainWindow.setMenu(null)

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  if (!fs.existsSync(path.join(__dirname, 'asserts/RELEASED'))) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('close', (e) => {
    // Do your control here
    if (transferCount > 0) {
      dialog.showMessageBox(
        mainWindow, {
        type: 'info',
        buttons: ['OK'],
        title: 'Cannot exit',
        message: 'Still transferring, cannot exit!'
      })
      e.preventDefault()
    }
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  // Send Message
  mainWindow.webContents.on('did-finish-load', () => {
    // Set user's downloads directory path to renderer.
    mainWindow.webContents.send('set-downloads-path', app.getPath('downloads'))
  })

  var accelerator = 'Ctrl+F'
  if (utils.isMacOS()) {
    accelerator = 'Command+F'
  }
  electronLocalshortcut.register(mainWindow, accelerator, () => {
    mainWindow.webContents.send('on-find')
  })

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(mainWindow)
}

ipcMain.on('set-transfer-count', (event, arg) => {
  transferCount = arg
})

ipcMain.on('set-transfer-progress', (event, arg) => {
  var transferProgress = arg / 100
  mainWindow.setProgressBar(transferProgress);
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit()
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
