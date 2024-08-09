/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 12, 2019
 * 
 * Helper methods for filesystem operations.
 */

const { FileSystemObject } = require("./FileSystemObject");

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
    /**
     * Construct a file delete operation request
     * @param {Partial<FileDeleteOperation>} opts
     * @param {FileDeleteOperation} parent
     */
    constructor(opts, parent) {
        /**
         * Has this process been aborted?
         */
        this.aborted = false;

        /**
         * The name of the file to delete
         * @type {(string | FileSystemObject)[]}
         */
        this.files = opts.files;

        /**
         * The name of the file to delete
         * @type {(string | FileSystemObject)[]}
         */
        this.verb = opts.verb || 'rm';

        /**
         * A function to call to confirm the delete (verb and filename are passed)
         * @type {function(string,string,boolean):boolean}
         */
        this.onConfirmDelete = typeof opts.onConfirmDelete === 'function' ? opts.onConfirmDelete : function () { return true; };

        /**
         * A function that fires when a file deletion is complete
         * @type {function(string,string,FileSystemObject):void}
         */
        this.onDeleteComplete = typeof opts.onDeleteComplete === 'function' ? opts.onDeleteComplete : function () { };

        /**
         * A function to call when a deletion fails
         * @type {function(string,string,string|Error):boolean}
         */
        this.onDeleteFailure = typeof opts.onDeleteFailure === 'function' && opts.onDeleteFailure;

        /**
         * A function to call when a displaying extra information
         * @type {function(string,string):boolean}
         */
        this.onDeleteInformation = typeof opts.onDeleteInformation === 'function' && opts.onDeleteInformation || function () { };

        /**
         * The name of the current, working directory
         * @type {string}
         */
        this.workingDirectory = opts.workingDirectory || '/';

        /**
         * Flags to control the operation
         * @type {number}
         */
        this.flags = opts.flags;

        /**
         * Mapping of relative path to resolved path
         * @type {Object.<string,string>}
         */
        this.filesResolved = {};
        this.files.forEach(f => {
            let fn = typeof f === 'string' ? f : f.fullPath;

            if (fn) {
                this.filesResolved[fn] = driver.efuns.resolvePath(fn, this.workingDirectory);
            }
        });

        this.parent = parent;
    }

    abort() {
        this.aborted = true;
        if (this.parent) {
            this.parent.abort();
        }
    }

    /**
     * Create a new request based in part on the settings in this request
     * @param {FileDeleteOperation} opts
     * @returns
     */
    createChild(opts) {
        let options = Object.assign({}, this, opts);
        return new FileDeleteOperation(options, this);
    }

    /**
     * Check if a particular delete flag is set
     * @param {number} f The flag to test
     * @returns True if the flag is set
     */
    hasFlag(f) {
        return (this.flags & f) > 0;
    }
}

module.exports = { FileCopyOperation, FileDeleteOperation };
