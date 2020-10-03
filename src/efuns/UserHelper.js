/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017-2020.  All rights reserved.
 * Date: September 28, 2020
 *
 * Provides user-related routines.
 */

/**
 * Various helper methods for user objects
 */
class UserHelper {
    /**
     * Fetch the user's home directory (if enabled)
     * @param {MUDObject | MUDWrapper} user The user to fetch a home directory for.
     */
    static getHomePath(user) {
        return unwrap(user, u => {
            return driver.getHomePath(u);
        });
    }
}

module.exports = UserHelper;
