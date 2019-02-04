/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Daemon = require('Daemon'),
    Dirs = require('Dirs');

const
    _directories = '_directories',
    _defaultSearchPath = '_defaultSearchPath',
    HelpDaemon = efuns.loadObject(Daemon.Help);

class CommandEntry {
    constructor(cmd, withExt, bin) {
        this.cmd = cmd;
        this.withExt = withExt;
        this.bin = bin;
    }
}

class CommandDirectory {
    constructor(dir) {
        this.commands = { length: 0 };
        this.directory = dir;
    }

    addCommand(cmd, withExt, bin) {
        this.commands[cmd] = { cmd, withExt, bin };
        this.commands.length++;
        return this;
    }

    getCommand(cmd) {
        return this.commands[cmd];
    }
}

class CommandResolver extends MUDObject {
    create() {
        this.setProperty(_directories, {});
        this.setProperty(_defaultSearchPath, [
            Dirs.DIR_CMDS_ITEMS,
            Dirs.DIR_CMDS_PLAYER,
            Dirs.DIR_CMDS_COMMON
        ]);
        this.hashCommandDirectory(
                Dirs.DIR_CMDS_ADMIN,
                Dirs.DIR_CMDS_COMMON,
                Dirs.DIR_CMDS_ITEMS,
                Dirs.DIR_CMDS_CREATOR,
                Dirs.DIR_CMDS_PLAYER)
            .hashCommandDirectory(
                Dirs.DIR_SCMDS_ADMIN,
                Dirs.DIR_SCMDS_ARCH,
                Dirs.DIR_SCMDS_CREATOR,
                Dirs.DIR_SCMDS_PLAYER);
    }

    get defaultSearchPath() {
        return this.getProperty(_defaultSearchPath, []);
    }

    /**
     * @returns {Object.<string,CommandDirectory>} Returns all hashed directories.
     */
    get directories() {
        return this.getProperty(_directories);
    }

    get directoryNames() {
        return Object.keys(this.directories);
    }

    /**
     * Scan a directory and index commands.
     * @param {...string} dirs The directory scan for commands.
     * @returns {CommandResolver} A reference to the daemon.
     */
    hashCommandDirectory(...dirs) {
        dirs.forEach(cmdDir => {
            let dirs = this.directories;

            if (cmdDir.endsWith('/')) cmdDir = cmdDir.slice(0, cmdDir.length - 1);

            let files = efuns.readDirectorySync(cmdDir + '/');
            if (Array.isArray(files)) {
                let dir = new CommandDirectory(cmdDir);

                files.forEach(file => {
                    let m = /([a-zA-Z0-9]+)\.js[x]*$/.exec(file);
                    if (m && m[1]) {
                        let verb = m[1].toLowerCase();
                        try {
                            let cmd = efuns.loadObject(`${cmdDir}/${m[1]}`) ||
                                efuns.loadObject(`${cmdDir}/${m[1]}$$`);

                            if (cmd) {
                                HelpDaemon().addCommand(cmd);
                                dir.addCommand(verb, file, cmd);
                            }
                        }
                        catch (e) {
                            logger.log(e.message);
                        }
                    }
                });
                if (dir.commands.length > 0) {
                    dirs[cmdDir] = dir;
                }
            }
            else throw err;
        });
        return this;
    }

    resolve(cmdName, searchPath) {
        let dirs = this.directories;

        searchPath = Array.isArray(searchPath) ? searchPath.slice(0) : this.defaultSearchPath;

        for (let i = 0; i < searchPath.length; i++) {
            let dir = dirs[searchPath[i]];
            if (dir) {
                var entry = dir.getCommand(cmdName);
                if (entry) {
                    if (typeof entry.bin === 'object')
                        return entry.bin;
                    let path = `${dir.directory}/${entry[0]}`;
                    return entry.bin = efuns.loadObject(path);
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

module.exports = new CommandResolver();
