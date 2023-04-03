/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { DIR_DAEMON, DIR_SDAEMON } = await requireAsync('./Dirs');

module.exports = Object.freeze({
    Body: DIR_DAEMON + '/BodyDaemon.js',
    Chat: DIR_DAEMON + '/ChatDaemon.js',
    Command: DIR_SDAEMON + '/CommandResolver.js',
    Emote: DIR_DAEMON + '/EmoteDaemon.js',
    Finger: DIR_SDAEMON + '/FingerDaemon.js',
    FileIndex: DIR_SDAEMON + '/FileIndex.js',
    Help: DIR_DAEMON + '/HelpSystem.js',
    I3Daemon: DIR_DAEMON + '/I3Daemon.js',
    Player: DIR_SDAEMON + '/PlayerDaemon.js'
});
