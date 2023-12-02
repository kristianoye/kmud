/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { DIR_DAEMON, DIR_SDAEMON } from './Dirs';

export const
    BODY_D = DIR_DAEMON + '/BodyDaemon.js',
    CHAT_D = DIR_DAEMON + '/ChatDaemon.js',
    COMMAND_D = DIR_SDAEMON + '/CommandResolver.js',
    EMOTE_D = DIR_DAEMON + '/EmoteDaemon.js',
    FILE_D = DIR_SDAEMON + '/FileIndex.js',
    FINGER_D = DIR_SDAEMON + '/FingerDaemon.js',
    HELP_D = DIR_DAEMON + '/HelpSystem.js',
    INTERMUD_D = DIR_DAEMON + '/I3Daemon.js',
    PLAYER_D = DIR_SDAEMON + '/PlayerDaemon.js';

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
