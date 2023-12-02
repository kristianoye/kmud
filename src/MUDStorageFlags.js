/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 16, 2019
 *
 * Helper methods for "living" objects.
 */
const MUDStorageFlags = Object.freeze({
    PROP_INTERACTIVE: 1 << 0,

    /** Indicates the object is connected (not linkdead) */
    PROP_CONNECTED: 1 << 1,

    /** Indicates the object is living and can execute commands */
    PROP_LIVING: 1 << 2,

    /** Indicates the object has wizard permissions */
    PROP_WIZARD: 1 << 3,

    /** Indicates the interactive object is idle */
    PROP_IDLE: 1 << 4,

    /** Indicates the object is in edit mode */
    PROP_EDITING: 1 << 5,

    /** Indicates the object is in input mode */
    PROP_INPUT: 1 << 6,

    /** Indicates the object has a heartbeat */
    PROP_HEARTBEAT: 1 << 7,

    /** Indicates the object is (or was) a player */
    PROP_ISPLAYER: 1 << 8,

    /** Indicates the object has been destroyed */
    PROP_DESTRUCTED: 1 << 9
});

module.exports = MUDStorageFlags;
