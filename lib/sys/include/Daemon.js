/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { DIR_DAEMON, DIR_SDAEMON } = require('./Dirs');

module.exports = Object.freeze({
    Chat: DIR_DAEMON + '/ChatDaemon',
    Command: DIR_SDAEMON + '/CommandResolver',
    Emote: DIR_DAEMON + '/EmoteDaemon',
    Finger: DIR_SDAEMON + '/FingerDaemon',
    FileIndex: DIR_SDAEMON + '/FileIndex',
    Help: DIR_DAEMON + '/HelpSystem',
    Intermud3: DIR_DAEMON + '/I3Daemon',
    Player: DIR_SDAEMON + '/PlayerDaemon'
});
