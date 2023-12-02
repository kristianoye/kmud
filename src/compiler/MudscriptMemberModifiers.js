
/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Bitflags used by MudScript language to modify class-related declarations
 */

module.exports = Object.freeze({
    Public: 1 << 0,
    Protected: 1 << 1,
    Private: 1 << 2,
    Package: 1 << 3,
    Abstract: 1 << 4,
    Final: 1 << 5,
    Override: 1 << 6,
    Singleton: 1 << 7,
    NoSave: 1 << 8,
    Static: 1 << 9,
    Async: 1 << 10,
    Origin: 1 << 11
});
