/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Dirs = require('./Dirs');

module.exports = Object.freeze({
    Command: Dirs.DIR_BASE + '/Command',
    Creator: Dirs.DIR_BASE + '/Creator',
    Player: Dirs.DIR_BASE + '/Player'
});