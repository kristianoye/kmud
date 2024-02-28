/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const CompilerFlags = Object.freeze({
    /** No additional flags */
    None: 0,

    /** Compile dependent modules */
    Recursive: 1 << 0,

    /** Compile only, do not re-create instances */
    CompileOnly: 1 << 1,

    /** Compile only, do not re-create dependent instances */
    OnlyCompileDependents: 1 << 2,

    /** Do not seal the compiled types - UNSAFE */
    NoSeal: 1 << 3,

    /** Flags that are safe for in-game objects to use */
    SafeFlags: 1 << 0 | 1 << 1 | 1 << 2
});

module.exports = CompilerFlags;
