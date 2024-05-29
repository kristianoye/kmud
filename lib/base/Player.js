/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import Interactive from './Interactive';
import { DIR_CMDS_PLAYER, DIR_SCMDS_PLAYER, DIR_CMDS_COMMON, DIR_CMDS_ITEMS } from '@Dirs';

export default class Player extends Interactive {
    override protected async connect(port, clientType) {
        efuns.living.enableHeartbeat(true);
        efuns.living.enablePlayer(this.name);

        this.searchPathAdd(
            DIR_CMDS_PLAYER,
            DIR_SCMDS_PLAYER,
            DIR_CMDS_COMMON,
            DIR_CMDS_ITEMS);

        return Object.assign(
            super.connect(port, clientType), {
                expandAliases: true,
                allowEnvironment: true,
                allowEscaping: true,
                allowHistory: true
            });
    }

    override set displayName(value) {
        if (efuns.normalizeName(value) === super.keyId) {
            super.displayName = value;
        }
    }

    override get displayName() {
        return super.displayName;
    }

    get emailAddress() {
        return get({});
    }

    set emailAddress(value) {
        if (String.notEmpty(value)) {
            set(value);
        }
    }

    getLevel() {
        return 1;
    }

    /** Maximum time a player can be idle */
    override get maxIdleTime() { return 60 * 60 * 1000; }

    protected override set keyId(value) {
        if (!super.keyId) {
            super.keyId = efuns.normalizeName(value);
        }
    }

    override get keyId() {
        return super.keyId;
    }

    protected get password() {
        return get('');
    }

    protected set password(value) {
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

    protected validatePassword(pwd) {
        return efuns.checkPassword(pwd, this.password);
    }

    get visible() {
        return get(true);
    }

    set visible(flag) {
        if (typeof flag === 'boolean')  set(flag);
    }
}
