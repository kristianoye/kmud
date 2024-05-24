/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
export const
    /** Directory base inheritables are located in */
    DIR_BASE = '/base',
    DIR_BASE_MIXINS = '/base/mixins',
    /** Directory containing non-secure commands */
    DIR_CMDS = '/cmds',
    DIR_DAEMON = '/daemon',
    DIR_SECURE = '/sys',
    DIR_SCMDS = '/sys/cmds',
    DIR_SDAEMON = '/sys/daemon',
    DIR_SLIB = '/sys/lib',
    DIR_CLASSES = DIR_SLIB + '/classes',
    DIR_RACES = DIR_SLIB + '/races';

module.exports = Object.freeze({
    DIR_BASE_MIXINS: DIR_BASE + '/mixins',

    DIR_CMDS_ADMIN: DIR_CMDS + '/admin',
    DIR_CMDS_COMMON: DIR_CMDS + '/common',
    DIR_CMDS_CREATOR: DIR_CMDS + '/creator',
    DIR_CMDS_ITEMS: DIR_CMDS + '/items',
    DIR_CMDS_PLAYER: DIR_CMDS + '/player',

    DIR_SCMDS_ADMIN: DIR_SCMDS + '/admin',
    DIR_SCMDS_ARCH: DIR_SCMDS + '/arch',
    DIR_SCMDS_CREATOR: DIR_SCMDS + '/creator',
    DIR_SCMDS_PLAYER: DIR_SCMDS + '/player',
    DIR_SCMDS_FILESYSTEM: DIR_SCMDS + '/filesystem',
});
