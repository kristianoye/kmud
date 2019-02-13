/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Dirs = require('Dirs'),
    Interactive = require(Base.Interactive);

class Player extends Interactive {
    protected constructor(filename) {
        super();

        if (filename)
            efuns.restoreObject(filename);
    }

    protected connect(port, clientType) {
        super.connect(port, clientType);
        this.enableHeartbeat(true);
    }

    isPlayer() { return true; }

    isVisible() {
        return this.getProperty('visible', true) !== false;
    }

    private loadPlayer(filename) {
        efuns.unguarded(() => {
            efuns.restoreObject(filename.slice(2));
        });
    }

    save(callback) {
        let PlayerDaemon = efuns.loadObjectSync(DAEMON_PLAYER);
        PlayerDaemon().savePlayer(this, callback);
    }

    protected get searchPath() {
        let sp = this.getProtected('searchPath', undefined);
        if (typeof sp === 'undefined') {
            sp = super.searchPath;
            sp.push(
                Dirs.DIR_CMDS_PLAYER,
                Dirs.DIR_SCMDS_PLAYER,
                Dirs.DIR_CMDS_COMMON,
                Dirs.DIR_CMDS_ITEMS);
            this.setProtected('searchPath', sp);
        }
        return sp.slice(0);
    }

    setPassword(str) {
        let prev = efuns.previousObject()
        if (!prev) {
            this.setProtected('password', str);
        }
    }
}

module.exports = Player;
