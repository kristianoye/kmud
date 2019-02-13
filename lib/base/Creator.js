/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Dirs = require('Dirs'),
    Daemon = require('Daemon'),
    Player = require(Base.Player),
    CreatorShell = require('../sys/lib/CreatorShell');

class Creator extends Player {
    protected constructor(filename) {
        super(filename);
        register('shell', new CreatorShell(this), PROTECTED);
     }

    dispatchInput(input, fromHistory) {
        if (thisPlayer !== this) {
            logger.log('Illegal force attempt');
            return;
        }
        return super.dispatchInput(input, fromHistory);
    }

    protected get shell() {
        return get('shell');
    }

    protected processInput(text) {
        return this.shell.processInput(text);
    }

    save(callback) {
        var PlayerDaemon = efuns.loadObjectSync(Daemon.Player);
        PlayerDaemon().saveCreator(this, callback);
    }

    get directoryStack() {
        return this.getProperty('directoryStack') || ['/'];
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
        let sp = this.getProtected('searchPath', undefined);
        if (typeof sp === 'undefined') {
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
                Dirs.DIR_SCMDS_CREATOR);

            var personalDir = `/realms/${this.primaryName}/cmds`;

            if (efuns.isDirectorySync(personalDir))
                sp.push(personalDir);
            this.setProtected('searchPath', sp);
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
