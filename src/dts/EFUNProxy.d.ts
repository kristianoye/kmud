/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2020.  All rights reserved.
 * Date: January 27, 2020
 */

declare interface EFUNProxy {
    /**
     * Returns the absolute value of the provided number
     * @param value
     */
    abs(value: number): number;
}

let efuns: EFUNProxy;
