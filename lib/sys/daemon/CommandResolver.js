/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Daemon = require('Daemon'),
    Dirs = require('Dirs'),
    async = require('async');

const
    HelpDaemon = efuns.loadObjectSync(Daemon.Help);


 /** @type {Object.<string,CommandDirectory[]>} */ const VerbLookup = {};

class CommandDirectory {
    /**
     * Construct a directory entry.
     * @param {string} dir The name of the directory index
     */
    constructor(dir) {
        this.commands = { length: 0 };
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

    getCommand(cmd) {
        return this.commands[cmd];
    }
}

class CommandResolver extends MUDObject {
    constructor() {
        super();

        this.defaultSearchPath = [
            Dirs.DIR_CMDS_ITEMS,
            Dirs.DIR_CMDS_PLAYER,
            Dirs.DIR_CMDS_COMMON
        ];
    }

    async createAsync() {
        await this.hashCommandDirectory(
            Dirs.DIR_SCMDS_FILESYSTEM,
            Dirs.DIR_CMDS_ADMIN,
            Dirs.DIR_CMDS_COMMON,
            Dirs.DIR_CMDS_ITEMS,
            Dirs.DIR_CMDS_CREATOR,
            Dirs.DIR_CMDS_PLAYER);

        await this.hashCommandDirectory(
            Dirs.DIR_SCMDS_ADMIN,
            Dirs.DIR_SCMDS_ARCH,
            Dirs.DIR_SCMDS_CREATOR,
            Dirs.DIR_SCMDS_PLAYER);
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

            if (cmdDir.endsWith('/')) cmdDir = cmdDir.slice(0, cmdDir.length - 1);

            let files = efuns.fs.readDirectorySync(cmdDir + '/');
            if (Array.isArray(files)) {
                let dir = new CommandDirectory(cmdDir);

                for (let i = 0, m = files.length; i < m; i++) {
                    let file = files[i], m = /([a-zA-Z0-9]+)\.js[x]*$/.exec(file);

                    if (m && m[1]) {
                        let verb = m[1].toLowerCase();
                        try {
                            let cmd = await efuns.loadObjectAsync(`${cmdDir}/${m[1]}`);

                            if (!cmd)
                                cmd = await efuns.loadObjectAsync(`${cmdDir}/${m[1]}$$`);

                            if (cmd) {
                                dir.addCommand(verb, file, cmd);
                                HelpDaemon().addCommand(cmd);
                            }
                        }
                        catch (e) {
                            logger.log(`\t\t- CommandResolver.hashCommandDirectory: ${files[i]} did not load: ${e.message}`);
                        }
                    }
                }
                if (dir.commands.length > 0) {
                    dirs[cmdDir] = dir;
                }
            }
            else throw err;
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
     * @returns {MUDObject} Returns a MUD object or false.
     */
    resolve(cmdName, searchPath) {
        let result = VerbLookup[cmdName] || false; 

        searchPath = Array.isArray(searchPath) ? searchPath : this.defaultSearchPath;

        if (result) {
            for (let i = 0; i < result.length; i++) {
                let dir = result[i];
                if (searchPath.indexOf(dir.directory) > -1) {
                    let entry = dir.getCommand(cmdName);
                    if (entry) {
                        if (typeof entry.bin === 'function')
                            return entry.bin();

                        let path = `${dir.directory}/${entry[0]}`;
                        return entry.bin = efuns.loadObjectSync(path);
                    }
                }
            }
        }
        return false;
    }

    updateCommand(cmd) {
        unwrap(cmd, o => {
            let path = o.filename.split('/'),
                file = path.pop(),
                dir = path.join('/'),
                dirs = this.directories;
            if (dir in dirs) {
                let cmddir = dirs[dir],
                    cmd = cmddir.getCommand(file.toLowerCase());
                cmd.bin = o;
            }
            HelpDaemon().addCommand(o, file.toLowerCase());
        });
    }
}

module.exports = await createAsync(CommandResolver);
