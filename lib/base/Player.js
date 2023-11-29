/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import Interactive from './Interactive';

const
    Dirs = await requireAsync('Dirs');

export default class Player extends Interactive {
    protected async connect(port, clientType) {
        efuns.living.enableHeartbeat(true);
        efuns.living.enablePlayer(this.name);

        this.searchPathAdd(
            Dirs.DIR_CMDS_PLAYER,
            Dirs.DIR_SCMDS_PLAYER,
            Dirs.DIR_CMDS_COMMON,
            Dirs.DIR_CMDS_ITEMS);

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

    get emailAddress() {
        return get({});
    }

    set emailAddress(value) {
        if (String.notEmpty(value)) {
            set(value);
        }
    }

    /** Maximum time a player can be idle */
    get maxIdleTime() { return 60 * 60 * 1000; }

    get keyId() {
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

    get realName() {
        return get('');
    }

    set realName(value) {
        if (String.notEmpty(value)) set(value);
    }

    protected async loadPlayer(filename) {
        return await efuns.restoreObjectAsync(filename);
    }

    async saveAsync(callback) {
        if (thisPlayer() === this) {
            return await efuns.saveObjectAsync();
        }
        return false;
    }

    get startLocation() {
        return get('/world/sarta/Square');
    }

    set startLocation(filename) {
        if (typeof filename === 'string')
            set(filename);
    }

    get visible() {
        return get(true);
    }

    set visible(flag) {
        if (typeof flag === 'boolean')  set(flag);
    }
}
