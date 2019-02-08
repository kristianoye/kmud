/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Interactive = require(Base.Interactive);

class Player extends Interactive {
    connect(client) {
        super.connect(client);
        client.eventSend({
            eventType: 'kmud.connected',
            eventData: this.displayName + '@' + efuns.mudName()
        });
        this.enableHeartbeat(true);
    }

    isPlayer() { return true; }

    isVisible() {
        return this.getProperty('visible', true) !== false;
    }

    private loadPlayer(filename) {
        console.log(`Loading ${filename}`);
    }

    save(callback) {
        let PlayerDaemon = efuns.loadObjectSync(DAEMON_PLAYER);
        PlayerDaemon().savePlayer(this, callback);
    }

    get searchPath() {
        let sp = super.searchPath;
        sp.push(DIR_CMDS_PLAYER, DIR_SCMDS_PLAYER);
        return sp;
    }

    setPassword(str) {
        let prev = efuns.previousObject()
        if (!prev) {
            this.setProtected('password', str);
        }
    }
}

module.exports = Player;
