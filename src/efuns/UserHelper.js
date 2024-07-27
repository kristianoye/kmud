/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017-2020.  All rights reserved.
 * Date: September 28, 2020
 *
 * Provides user-related routines.
 */

const { ExecutionContext } = require("../ExecutionContext");

/**
 * Various helper methods for user objects
 */
class UserHelper {
    /**
     * Fetch the user's home directory (if enabled)
     * @param {ExecutionContext} ecc The current callstack
     * @param {MUDObject | MUDWrapper | string} user The user to fetch a home directory for.
     */
    static getHomePath(ecc, userIn) {
        let [frame, user] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'getHomePath', callType: CallOrigin.DriverEfun });
        try {
            return unwrap(user, u => {
                return driver.getHomePath(u);
            });
        }
        finally {
            frame?.pop();
        }
    }
}

module.exports = UserHelper;
