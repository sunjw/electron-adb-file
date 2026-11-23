const { ipcRenderer } = require('electron');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class EleConfig {

    constructor(userDataPath) {
        this.configPath = path.join(userDataPath, 'ele-config.json');
        this.configJson = {};
    }

    loadConfig() {
        if (fs.existsSync(this.configPath)) {
            let configData = fs.readFileSync(this.configPath);
            try {
                this.configJson = JSON.parse(configData);
            } catch (e) {}
        }
    }

    getConfig(key) {
        this.loadConfig();
        return this.configJson[key];
    }

    setConfig(key, value) {
        this.loadConfig();
        this.configJson[key] = value;
        fs.writeFileSync(this.configPath, JSON.stringify(this.configJson, null, 2));
    }
}

function sendToMain(message) {
    ipcRenderer.send('dialog', message);
}

function stopBubble(event) {
    // only for electron
    event.stopPropagation();
}

// A short id that is safe to put in an url. It is used as the transfer id,
// which travels through the url hash and comes back.
function getShortUuid() {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 8);
}

exports.EleConfig = EleConfig;
exports.sendToMain = sendToMain;
exports.stopBubble = stopBubble;
exports.getShortUuid = getShortUuid;
