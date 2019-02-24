/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Dirs = require('Dirs'),
    Daemon = require('Daemon'),
    Player = require(Base.Player);

class Creator extends Player {
    protected constructor(filename, data) {
        super(filename, data);

        register('directoryStack', ['/'], PRIVATE);
        register('interactive/:shellVariables', {
            HOME: () => `/realms/${this.keyId}`
        });
    }

    protected get directoryStack() {
        return get('directoryStack', [], PRIVATE);
    }

    protected set directoryStack(stack) {
        if (Array.isArray(stack))
            set('directoryStack', stack, PRIVATE);
    }

    protected dispatchInput(input, fromHistory) {
        if (thisPlayer !== this) {
            logger.log('Illegal force attempt');
            return;
        }
        return super.dispatchInput(input, fromHistory);
    }

    protected executeShellCommand(cmd) {
        switch (cmd.verb) {
            case 'cd':
                return (async () => {
                    let homedir = this.getenv('HOME') || '/', newdir = cmd.args.length ?
                        efuns.resolvePath(cmd.args[0], this.workingDirectory) : homedir;

                    let [isDirectory, error] = await efuns.fs.isDirectoryAsync(newdir);
                    if (!isDirectory)
                        return errorLine(`cd: '${newdir}' no such file or directory`);
                    this.directoryStack[0] = newdir;
                    return true;
                })();

            case 'popd': // Pop directory stack
                {
                    if (this.directoryStack.length === 1)
                        return errorLine('popd: Directory stack is empty');
                    this.directoryStack.shift();
                    return writeLine(this.directoryStack.join(' '));
                }

            case 'pushd': // Push directory stack
                return async () => {
                    let homedir = this.getenv('HOME') || '/', newdir = cmd.args.length ?
                        efuns.resolvePath(cmd.args[0], this.workingDirectory) : homedir;

                    let [isDirectory, error] = await efuns.fs.isDirectoryAsync(newdir);
                    if (!isDirectory)
                        return errorLine(`pushd: '${newdir}' no such file or directory`);
                    this.directoryStack.unshift(newdir);
                    return writeLine(this.directoryStack.join(' '));
                };

            case 'pwd': // Print working directory
                {
                    return writeLine(this.workingDirectory);
                }
        }
        let result = super.executeShellCommand(cmd);
        return result;
    }


    /** Immortals are allowed to idle indefinitely */
    get maxIdleTime() { return Number.MAX_SAFE_INTEGER; }

    private prepareCommand() {
        return {
            allowAliases: true,
            allowChaining: true,
            allowEnvironment: true,
            allowFileExpressions: true,
            allowLineSpanning: true,
            allowEscaping: true,
            allowFileIO: true,
            allowHistory: true,
            allowObjectShell: true
        };
    }

    protected processInput(text) {
        return this.shell.processInput(text);
    }

    save(callback) {
        var PlayerDaemon = efuns.loadObjectSync(Daemon.Player);
        PlayerDaemon().saveCreator(this, callback);
    }

    displayStack() {
        var ds = this.directoryStack, s = [];
        for (var i = ds.length - 1; i > -1; i--) { s.push(ds[i]); }
        this.writeLine(s.join(' '));
        this.setProperty('directoryStack', ds);
    }

    getenv(name) {
        return name === 'test' ? 'Kriton' : '';
    }

    get searchPath() {
        let sp = get('body/searchPath', []);
        if (!Array.isArray(sp) || sp.length === 0) {
            sp = super.searchPath;

            if (efuns.adminp(this)) {
                sp.push(Dirs.DIR_SCMDS_ADMIN,
                    Dirs.DIR_SCMDS_ARCH,
                    Dirs.DIR_CMDS_ADMIN);
            }
            else if (efuns.archp(this)) {
                sp.push(Dirs.DIR_SCMDS_ARCH);
            }

            sp.push(Dirs.DIR_CMDS_CREATOR,
                Dirs.DIR_SCMDS_CREATOR,
                Dirs.DIR_SCMDS_FILESYSTEM);

            var personalDir = `/realms/${this.primaryName}/cmds`;

            if (efuns.isDirectorySync(personalDir))
                sp.push(personalDir);
            set('body/searchPath', sp);
        }
        return sp.slice(0);
    }

    get workingDirectory() {
        var stack = this.directoryStack;
        return stack.length > 0 ? stack[stack.length - 1] : '/';
    }

    set workingDirectory(dir) {
        var stack = this.directoryStack;
        if (efuns.isDirectorySync(dir)) {
            stack[stack.length - 1] = dir;
            this.setProperty('directoryStack', stack);
        }
    }
}

module.exports = Creator;
