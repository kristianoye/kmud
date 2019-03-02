/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

const
    Base = require('Base'),
    Dirs = require('Dirs'),
    Interactive = require('./Interactive');

class Player extends Interactive {
    protected constructor(filename, data) {
        super(data);

        if (data) {
            this.keyId = efuns.normalizeName(data.name);
            this.gender = data.gender;
            this.displayName = data.name;
        }
    }

    protected connect(port, clientType) {
        efuns.living.enableHeartbeat(true);
        efuns.living.enablePlayer(this.name);
        return Object.assign(
            super.connect(port, clientType), {
                allowAliases: true,
                allowEnvironment: true,
                allowEscaping: true,
                allowHistory: true
            });
    }

    get displayName() {
        return super.displayName;
    }

    set displayName(value) {
        if (efuns.normalizeName(value) === super.keyId) {
            super.displayName = value;
        }
    }

    /** Maximum time a player can be idle */
    get maxIdleTime() { return 60 * 60 * 1000; }

    protected get keyId() {
        return super.keyId;
    }

    protected set keyId(value) {
        if (!super.keyId) {
            super.keyId = efuns.normalizeName(value);
        }
    }

    get password() {
        return get('');
    }

    set password(value) {
        if (typeof value === 'string' && value.length > 0) {
            set(value);
        }
    }

    save(callback) {
        if (thisPlayer() === this) {
            return efuns.saveObject();
        }
        return false;
    }

    protected get searchPath() {
        let sp = get([]);
        if (!Array.isArray(sp) || sp.length === 0) {
            sp = super.searchPath;
            sp.push(
                Dirs.DIR_CMDS_PLAYER,
                Dirs.DIR_SCMDS_PLAYER,
                Dirs.DIR_CMDS_COMMON,
                Dirs.DIR_CMDS_ITEMS);
            set(sp);
        }
        return sp.slice(0);
    }

    get visible() {
        return get('player/visible', true);
    }

    set visible(flag) {
        if (typeof flag === 'boolean') {
            set('player/visible', flag);
        }
    }
}

module.exports = Player;

