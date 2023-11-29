/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Base for most command objects
 */
const
    ShellFlags = system.flags.shell.ShellFlags;

export default class Command extends MUDObject {
    /**
     * Run the command
     * @param {string} text The text that followed after the command name
     * @param {any[]} args The arguments after they were parsed [advanced]
     */
    cmd(text, args) {
        throw 'Command not implemented';
    }

    /**
     * Provides help to the help system.
     * @returns {MUDCommandHelp}
     */
    getHelp() {
        return 'There is no help available';
    }

    /**
     * Get shell options for this command
     * @param {string} verb The verb being executed
     * @returns {number}
     */
    getShellFlags(verb) {
        return ShellFlags.AllowEnvironment | ShellFlags.AllowLineSpanning;
    }

    parseOptions(args) {
        var result = { defaults: [] }, cur = undefined;

        for (var i = 0, len = args.length; i < len; i++) {
            var arg = args[i];
            if (arg.startsWith('-') || arg.startsWith('/')) {
                arg = arg.substr(arg.startsWith('--') ? 2 : 1);
                if (!result[cur = arg]) result[arg] = [];
                continue;
            }
            result[cur || 'defaults'].push(arg);
        }
        return result;
    }

    prepareCommand(user) {
        if (this.filename.indexOf('filesystem') > 0 || this.filename.indexOf('creator') > 0 || this.filename.indexOf('admin') > 0 || this.filename.indexOf('arch') > 0) {
            let isWizard = efuns.living.isWizard(user);
            return {
                allowAliases: true,
                allowPipelining: isWizard,
                allowEnvironment: true,
                allowFileExpressions: true,
                allowLineSpanning: true,
                allowEscaping: true,
                allowFileIO: isWizard,
                allowHistory: true,
                allowObjectShell: isWizard
            };
        }
        return {
            allowAliases: true,
            allowPipelining: false,
            allowEnvironment: true,
            allowFileExpressions: false,
            allowLineSpanning: false,
            allowEscaping: false,
            allowFileIO: false,
            allowHistory: true,
            allowObjectShell: false
        };
    }

    /**
     * Generate a usage error.
     * @param {string} str
     */
    useError(str) {
        return efuns.queryVerb() + ': ' + str;
    }

    /** @type {false|string[]} A list of verbs used to invoke this command */
    get verbs() {
        return false;
    }
}
