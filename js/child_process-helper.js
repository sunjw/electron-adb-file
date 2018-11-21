const Utils = require('./utils.js');
const ChildProcess = require('child_process');

class ChildProcessHelper {
    constructor(cmd, args) {
        this.cmd = cmd;
        this.args = args;
    }

    run(onStdOutCallback, onExitCallback = 0) {
        const childCmd = ChildProcess.spawn(this.cmd, this.args);
        var errToCallback = 0;

        childCmd.stdout.on('data', (data) => {
            onStdOutCallback(this, data);
        });

        childCmd.stderr.on('data', (data) => {
            onStdOutCallback(this, data);
        });

        childCmd.on('error', (err) => {
            // error happened before close
            errToCallback = err;
            Utils.log('[' + this.cmd + '] exited with error: ' + err);
        });

        childCmd.on('close', (code) => {
            Utils.log('[' + this.cmd + '] exited with code: ' + code);
            if (onExitCallback != 0) {
                onExitCallback(this, code, errToCallback);
            }
        });
    }
}

// exports
exports.ChildProcessHelper = ChildProcessHelper;
