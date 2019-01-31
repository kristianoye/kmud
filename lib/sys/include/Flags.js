/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
module.exports = Object.freeze({
    FTYPE: Object.freeze({
        Directory: 1, 
        File: 2
    }),
    GETDIR: Object.freeze({
        Detail: 1,
        Perms: 1 << 1,
        Status: 1 << 2
    }),
    GETDIR_GETDETAIL: 1 << 0,
    GETDIR_GETPERMS: 1 << 1,
    GETDIR_GETSTATUS: 1 << 2,

    FTYPE_DIRECTORY: 1,
    FTYPE_FILE: 2
});

