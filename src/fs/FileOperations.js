/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

class FileCopyOperation {
    /**
     * Construct a file copy operation request
     * @param {FileCopyOperation} opts
     */
    constructor(opts) {
        /**
         * Should a backup be created if the destination exists?
         * @type {string}
         */
        this.backupControl = typeof opts.backupControl === 'string' && opts.backupControl;

        /**
         * Suffix to append to backup filenames
         * @type {string}
         */
        this.backupSuffix = typeof opts.backupSuffix === 'string' && opts.backupSuffix || '~';

        /**
         * Where is this file object going?
         * @type {string} The name of the destination
         */
        this.destination = opts.destination;

        /**
         * Flags (see CopyFlags)
         * @type {number} 
         */
        this.flags = opts.flags || 0;

        /**
         * Method to execute if an overwrite will occur
         * @type {function(string,string,string,string):void} 
         */
        this.onCopyComplete = typeof opts.onCopyComplete === 'function' && opts.onCopyComplete || function () { };

        /**
         * Method to execute if an copy error is thrown
         * @type {function(string,string):void} 
         */
        this.onCopyError = typeof opts.onCopyError === 'function' && opts.onCopyError;

        /**
         * Display arbitrary string during copy operation
         * @type {function(string,string):void} 
         */
        this.onCopyInformation = typeof opts.onCopyInformation === 'function' && opts.onCopyInformation || function () { };

        /**
         * Method to execute if an overwrite will occur
         * @type {function(string,string):boolean} 
         */
        this.onOverwritePrompt = typeof opts.onOverwritePrompt === 'function' && opts.onOverwritePrompt || function () { return false };

        /**
         * What is being copied?
         * @type {string}
         */
        this.source = opts.source;

        this.resolvedDestination = this.destination;
        this.resolvedSource = this.source;

        /**
         * The verb or method executing this request
         * @type {string}
         */
        this.verb = opts.verb || 'copyAsync()';

        /**
         * The working directory from which relative paths can be resolved
         * @type {string}
         */
        this.workingDirectory = opts.workingDirectory || '/';

        if (this.destination.charAt(0) !== '/') {
            this.resolvedDestination = driver.efuns.resolvePath(this.destination, this.workingDirectory);
        }
        if (this.source.charAt(0) !== '/') {
            this.resolvedSource = driver.efuns.resolvePath(this.source, this.workingDirectory);
        }
    }

    /**
     * Create a new request based in part on the settings in this request
     * @param {FileCopyOperation} opts
     * @returns
     */
    createChild(opts) {
        let options = Object.assign({}, this, opts);
        return new FileCopyOperation(options);
    }

    /**
     * Check if a particular copy flag is set
     * @param {number} f The flag to test
     * @returns True if the flag is set
     */
    hasFlag(f) {
        return (this.flags & f) > 0;
    }
}

class FileDeleteOperation {

}

module.exports = { FileCopyOperation };
