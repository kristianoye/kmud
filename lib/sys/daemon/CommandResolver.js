/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { HELP_D } from '@Daemon';
import {
    DIR_CMDS_ITEMS,
    DIR_CMDS_COMMON,
    DIR_SCMDS_FILESYSTEM,
    DIR_CMDS_ADMIN,
    DIR_SCMDS_ADMIN,
    DIR_SCMDS_ARCH,
    DIR_CMDS_CREATOR,
    DIR_SCMDS_CREATOR,
    DIR_CMDS_PLAYER,
    DIR_SCMDS_PLAYER
} from '@Dirs';

const
    HelpDaemon = await efuns.loadObjectAsync(HELP_D);


 /** @type {Object.<string,CommandDirectory[]>} */ const VerbLookup = {};

class CommandDirectory {
    /**
     * Construct a directory entry.
     * @param {string} dir The name of the directory index
     */
    create(dir) {
        this.directory = dir;
        this.rank = 0;

        let lcDir = dir.toLowerCase();
        if (lcDir.indexOf('creator') > -1 || lcDir.indexOf('wizard') > -1)
            this.rank += 1;
        else if (lcDir.indexOf('arch') > -1 || lcDir.indexOf('realms') > -1)
            this.rank += 2;
        else if (lcDir.indexOf('admin') > -1)
            this.rank += 3;
    }

    /**
     * Add a command to the directory entry.
     * @param {string} cmd
     * @param {string} withExt
     * @param {string} bin
     */
    addCommand(cmd, withExt, bin) {
        this.commands[cmd] = { cmd, withExt, bin };
        this.commands.length++;

        if (cmd in VerbLookup === false)
            VerbLookup[cmd] = [];

        VerbLookup[cmd].push(this);
        VerbLookup[cmd].sort((a, b) => a.rank > b.rank ? -1 : 0);

        return this;
    }

    getCommand(cmd, allowPartial = false, asArray = false) {
        if (allowPartial === true) {
            let result = [];
            for (const [verb, entry] of Object.entries(this.commands)) {
                if (verb.startsWith(cmd))
                    result.push(entry);
            }
            return result;
        }
        if (asArray)
            return cmd in this.commands ? [this.commands[cmd]] : [];
        return this.commands[cmd];
    }

    get commands() {
        return get({ length: 0 });
    }

    get directory() {
        return get('/');
    }

    set directory(s) {
        set(s);
    }

    get rank() {
        return get(0);
    }

    set rank(n) {
        set(n);
    }
}

export default singleton class CommandResolver {
    private async create() {
        super.create();
        try {

            this.defaultSearchPath = [
                DIR_CMDS_ITEMS,
                DIR_CMDS_PLAYER,
                DIR_CMDS_COMMON
            ];
            await this.hashCommandDirectory(
                DIR_SCMDS_FILESYSTEM,
                DIR_CMDS_ADMIN,
                DIR_CMDS_COMMON,
                DIR_CMDS_ITEMS,
                DIR_CMDS_CREATOR,
                DIR_CMDS_PLAYER);

            await this.hashCommandDirectory(
                DIR_SCMDS_ADMIN,
                DIR_SCMDS_ARCH,
                DIR_SCMDS_CREATOR,
                DIR_SCMDS_PLAYER);
        }
        catch (err) {
            console.log(err);
        }
    }

    /**
     * @type {string[]}
     */
    get defaultSearchPath() {
        return get([]).slice(0);
    }

    /** @type {string[]} */
    private set defaultSearchPath(value) {
        if (Array.isArray(value)) {
            set(value.filter(s => typeof s === 'string' && s.length > 0));
        }
    }

    /**
     * @returns {Object.<string,CommandDirectory>} Returns all hashed directories.
     */
    get directories() {
        return get({});
    }

    /** @type {string[]} */
    get directoryNames() {
        return Object.keys(this.directories);
    }

    /**
     * Scan a directory and index commands.
     * @param {...string} dirs The directory scan for commands.
     * @returns {CommandResolver} A reference to the daemon.
     */
    async hashCommandDirectory(...dirs) {
        for (let j = 0, jm = dirs.length; j < jm; j++) {
            let cmdDir = dirs[j];

            if (cmdDir.endsWith('/')) {
                cmdDir = cmdDir.slice(0, cmdDir.length - 1);
            }

            let dirObj = await efuns.fs.getDirectoryAsync(cmdDir),
                files = await dirObj.readAsync('.js[x]*$');

            if (Array.isArray(files) && files.length > 0) {
                let dir = await createAsync(CommandDirectory, cmdDir);

                this.directories[dirObj.fullPath] = dir;

                for (let i = 0, m = files.length; i < m; i++) {
                    let file = files[i],
                        m = /([a-zA-Z0-9]+)\.js[x]*$/.exec(file.name);

                    if (m && m[1]) {
                        try {
                            let cmd = await efuns.objects.loadObjectAsync(file.path);

                            if (cmd) {
                                let verb = cmd().verbs || m[1].toLowerCase();

                                if (Array.isArray(verb))
                                    verb.forEach(v => dir.addCommand(v, file.name, cmd));
                                else if (typeof verb === 'string')
                                    dir.addCommand(verb, file.name, cmd);
                                await HelpDaemon().addCommand(cmd)
                                    .catch(err => {
                                        debugger;
                                        logger.log(`\t\t- Warning: Failed to index helpfor cmd ${m[1]}`);
                                    });
                            }
                        }
                        catch (e) {
                            logger.log(`\t\t- CommandResolver.hashCommandDirectory: ${file.path} did not load: ${(e.message || e)}`);
                        }
                    }
                }
                if (dir.commands.length > 0) {
                    dirs[cmdDir] = dir;
                }
            }
            else console.log(`No matching files found in ${dirObj.path}`);
        }
        return this;
    }

    isShellCommand(verb) {
        return true;
    }

    /**
     * Match a verb with the appropriate version of the command (if available)
     * @param {string} cmdName The name of the command/verb to resolve.
     * @param {string[]} searchPath The directories this object has access to.
     * @param {boolean} allowPartial If true, then a player may specify a partial command name (e.g. 'sc' would resolve to 'score')
     * @returns {MUDObject} Returns a MUD object or false.
     */
    async resolveAsync(cmdName, searchPath, allowPartial = false) {
        let result = [];

        searchPath = Array.isArray(searchPath) ? searchPath : this.defaultSearchPath;

        for (const [dirName, dir] of Object.entries(this.directories)) {
            if (searchPath.indexOf(dirName) > -1) {
                let entries = dir.getCommand(cmdName, allowPartial, true);

                for (const entry of entries) {
                    if (typeof entry.bin === 'function')
                        result.push(entry.bin());
                    else {
                        try {
                            let path = `${dir.directory}/${entry[0]}`;
                            entry.bin = await efuns.loadObjectAsync(path);
                            if (typeof entry.bin === 'function') {
                                result.push(entry.bin());
                                continue;
                            }
                        }
                        catch (err) {
                            await efuns.logError(err);
                        }
                        entry.bin = () => errorLine(`${entry.cmd}: Command is currently broken`);
                        result.push(entry.bin());
                    }

                    //  Exact match wins over partial
                    if (entry.cmd === cmdName)
                        return entry.bin();
                }
            }
        }
        if (result.length === 0)
            return false;
        else if (result.length === 1)
            return result[0];
        else
            return result;
    }
}
