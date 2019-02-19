/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 18, 2017
 */

module.exports = Object.freeze({
    //  The user's total age in ms
    PROP_AGE: 'interactive/age/total',

    //  The amount of time the user has spent more than 1 minute idle
    PROP_AGEIDLE: 'interactive/age/idle',

    //  The user's stored aliases
    PROP_ALIASES: 'interactive/aliases',

    //  The time the user was created
    PROP_BIRTHDAY: 'interactive/age/birthday',

    //  The channels the user is subscribed to
    PROP_CHANNELS: 'interactive/channels',

    //  The last time the user was seen
    PROP_LASTLOGIN: 'interactive/age/lastLogin'
});
