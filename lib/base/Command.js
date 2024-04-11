/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Base for most command objects
 */
import ArgParser from './ArgParser';

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

    /** @returns {ArgParser} */
    get command() {
        return get(new ArgParser());
    }

    create() {
        this.command
            .setAuthor('Kris Oye')
            .setCopyright(`Copyright (C) 2017 by Kristian Oye
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
`)
            .setVersion('1.0');
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
    getShellSettings(verb, options) {
        return Object.assign(options, { command: this });
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

    get primaryVerb() {
        let verbs = this.verbs || [];
        if (verbs.length === 0) {
            let name = this.fullPath.split('/').pop(),
                n = name.indexOf('.');
            if (n > -1) {
                name = name.slice(0, n);
            }
            return name.toLowerCase();
        }
        return verbs[0];
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
        return get(false);
    }

    protected set verbs(arg) {
        if (typeof arg === 'string') {
            set([arg]);
        }
        else if (Array.isArray(arg)) {
            set(arg.filter(s => typeof s === 'string'));
        }
    }
}
