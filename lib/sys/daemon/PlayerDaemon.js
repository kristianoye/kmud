/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Daemon = await requireAsync('Daemon'),
    ChatDaemon = await efuns.loadObjectAsync(Daemon.Chat),
    AutoWiz = efuns.featureEnabled('autoWiz');

class PlayerDaemon extends MUDObject {
    createNewCharacter(data) {
        let vpath = this.playerVirtualPath(data.name, AutoWiz),
            player = efuns.loadObjectSync(vpath, data);

        ChatDaemon().broadcast('announce', `${player().displayName} has entered the world for the first time!`);

        if (AutoWiz)
            efuns.log('newplayers', `${player().displayName} [CREATOR] was created at ${(new Date().toUTCString())}`)
        else
            efuns.log('newplayers', `${player().displayName} was created at ${(new Date().toUTCString())}`)

        return player;
    }

    creatorFilename(name) {
        let unw = unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        let norm = this.normalizeName(name),
            creatorDirectory = `/sys/data/creators/${norm.charAt(0)}/`,
            creatorFile = `/sys/data/creators/${norm.charAt(0)}/${norm}.json`;

        efuns.unguarded(() => {
            efuns.mkdir(creatorDirectory, {
                flags: MUDFS.MkdirFlags.EnsurePath
            });
        });
        return creatorFile;
    }

    createWizard(_player) {
        if (thisPlayer && efuns.archp(thisPlayer)) {
            let player = unwrap(_player);
            return this.saveCreator(player);
        }
    }

    async ensureSaveDirectoryExists() {
        let tp = thisPlayer(),
            fn = tp.filename,
            dir = fn.slice(0, fn.lastIndexOf('/'));

        return await efuns.fs.createDirectoryAsync(dir, MUDFS.MkdirFlags.IgnoreExisting | MUDFS.MkdirFlags.EnsurePath);
    }

    /**
        * Loads a player object.
        * @param {string} name The name of the player to load.
        * @param {{ username: string, password: string }} data The HTTP or Telnet client instance ofthe connecting user.
        * @param {function} callback The callback to execute when the user creation is complete.
        */
    loadPlayer(name, data, callback = false) {
        let n = this.normalizeName(name),
            cn = this.creatorFilename(n),
            fn = this.playerFilename(n);

        if (efuns.isFile(cn)) {
            try {
                let playerData = efuns.readJsonFileSync(cn), creator = false;
                try {
                    let pfn = this.playerVirtualPath(n, true);

                    creator = efuns.findObject(pfn);

                    if (!creator) {
                        creator = efuns.loadObjectSync(pfn);
                        if (creator) {
                            ChatDaemon().broadcast('announce', `${(creator().displayName)} has entered the game.`);
                            efuns.log('login', `${creator().displayName} [CREATOR] logged in at ${(new Date().toUTCString())}`)
                        }
                    } else {
                        ChatDaemon()
                            .broadcast('announce', `${(creator().displayName)} has re-connected.`);
                        efuns.log('login', `${player().displayName} logged in at ${(new Date().toUTCString())}`)
                    }
                }
                catch (_e) {
                    logger.log('Failure to load: %s', _e);
                    logger.log(_e.stack);
                }
                return callback(creator, false);
            }
            catch (err) {
                callback(false, err);
            }
        }
        else {
            return efuns.readJsonFileSync(fn, (playerData, err) => {
                let player = false;
                if (!err) {
                    try {
                        let pfn = this.playerVirtualPath(name, false);
                        player = efuns.findObject(pfn);
                        if (!player) {
                            player = efuns.loadObjectSync(pfn, playerData);
                            ChatDaemon().broadcast('announce', `${(player().displayName)} has entered the game.`);
                        } else {
                            /* player loaded but linkdead */
                            ChatDaemon().broadcast('announce', `${(player().displayName)} has re-connected.`);
                        }
                    }
                    catch (_e) {
                        logger.log('Failure to load: %s', _e);
                        logger.log(_e.stack);
                    }
                    callback.call(this, player);
                }

            });
        }
    }

    protected playerVirtualPath(name, creator) {
        let pname = this.normalizeName(name),
            dir = efuns.join('/sys/data/', creator ? 'creators' : 'players', '/', pname.charAt(0)),
            file = `${dir}/${pname}`;
        efuns.unguarded(() => {
            efuns.mkdir(dir);
        });
        return file;
    }

    loadPlayerData(name, cb) {
        let cf = this.creatorFilename(name),
            pf = this.playerFilename(name);

        if (efuns.isFile(cf)) {
            try {
                let playerData = efuns.readJsonFileSync(cf);
                return cb(playerData, false);
            }
            catch (err) {
                return cb(false, err);
            }
        }
        else if (efuns.isFile(pf)) {
            try {
                let playerData = efuns.readJsonFileSync(pf);
                return cb(playerData, false);
            }
            catch (err) {
                return cb(false, err);
            }
        }
        else {
            return cb.call(this, null, `No player exists by that name (${name})`);
        }
    }

    normalizeName(name) {
        return (name || '').toLowerCase().replace(/[^a-z]+/g, '');
    }

    /**
     * Checks to see if the specified player exists.  If the player does exist then the 
     * result returns true along with the filename of the player to load data from.
     * @param {string} name The name of the player to load.  If the name starts with '@' then only try player  file
     * @param {function(boolean,string):void} callback The callback that receives the data.
     */
    async playerExists(name, loadPlayer = false, callback = false) {
        if (typeof loadPlayer === 'function') {
            callback = loadPlayer;
            loadPlayer = false;
        }
        if (typeof callback !== 'function') {
            throw new Error(`playerExists() requires valid callback parameter`);
        }
        let playerFile = this.playerFilename(name),
            creatorFile = this.creatorFilename(name);

        if (name.startsWith('@')) {
            creatorFile = false;
            name = efuns.normalizeName(name.slice(1));
        }
        if (creatorFile) {
            let result = await efuns.readJsonFileAsync(creatorFile);
            if (!efuns.isError(result)) {
                return callback ? callback(result) : result;
            }
        }
        if (playerFile) {
            let result = await efuns.readJsonFileAsync(playerFile);

            if (!efuns.isError(result)) {
                return callback ? callback(result) : result;
            }
        }
        return callback ? callback(false) : false;
    }

    playerExistsSync(name) {
        return efuns.isFileSync(this.playerFilename(name)) ||
            efuns.isFileSync(this.creatorFilename(name));
    }

    playerFilename(name) {
        let unw = unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        let norm = this.normalizeName(name),
            playerFile = `/sys/data/players/${norm.charAt(0)}/${norm}.json`;
        return playerFile;
    }

    saveCreator(player, callback) {
        efuns.unguarded(() => {
            let fn = this.creatorFilename(player);
            efuns.writeJsonFile(fn, player.serializeObject(), callback);
            return true;
        });
        return false;
    }

    savePlayer(player, callback) {
        efuns.unguarded(() => {
            let fn = this.playerFilename(player),
                dir = fn.slice(0, fn.lastIndexOf('/')) + '/';
            efuns.mkdir(dir, function (err, dir) {
                if (err) {
                    throw err;
                } else {
                    efuns.writeJsonFile(fn, player.serializeObject(), callback);
                }
            });
        });
    }
}

module.exports = new PlayerDaemon();
