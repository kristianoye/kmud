var ChatDaemon,
    AutoWiz = false;

class PlayerDaemon extends MUDObject {
    create() {
        ChatDaemon = efuns.loadObject('/daemon/ChatDaemon');
    }

    createNewCharacter(data, callback) {
        var vpath = this.playerVirtualPath(data.name, AutoWiz),
            client = data.args.client,
            player = efuns.loadObject(vpath, data);
        try {
            ChatDaemon().broadcast('announce', '{0} has entered the world for the first time!'.fs(player().displayName));
            player().setClient(client);
            callback.call(this, player);
        }
        catch (e)
        {
            callback.call(this, false);
        }
    }

    creatorFilename(name) {
        var unw = unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        var norm = this.normalizeName(name),
            creatorFile = '/sys/data/creators/{0}/{1}.json'.fs(norm.charAt(0), norm);
        return creatorFile;
    }

    createWizard(_player) {
        if (thisPlayer && efuns.archp(thisPlayer)) {
            var player = unwrap(_player);
            return this.saveCreator(player);
        }
    }

    /**
        * Loads a player object.
        * @param {string} name The name of the player to load.
        * @param {ClientInstance} client The HTTP or Telnet client instance ofthe connecting user.
        * @param {function} cb The callback to execute when the user creation is complete.
        */
    loadPlayer(name, data, cb) {
        var self = this,
            n = this.normalizeName(name),
            cn = this.creatorFilename(n),
            fn = this.playerFilename(n);

        if (efuns.isFile(cn)) {
            return efuns.readJsonFile(cn, (playerData, err) => {
                var creator = false;
                if (!err) {
                    try {
                        var pfn = this.playerVirtualPath(n, true);
                        creator = efuns.findObject(pfn);
                        if (!creator) {
                            creator = efuns.loadObject(pfn, playerData);
                            ChatDaemon().broadcast('announce', '{0} has entered the game.'.fs(creator().displayName));
                        } else {
                            ChatDaemon().broadcast('announce', '{0} has re-connected.'.fs(creator().displayName));
                            efuns.unguarded(() => {
                                creator().setClient(data.args.client);
                            });
                        }
                    }
                    catch (_e) {
                        console.log('Failure to load: %s', _e);
                        console.log(_e.stack);
                    }
                    cb.call(this, creator);
                }

            });
        }
        else {
            return efuns.readJsonFile(fn, (playerData, err) => {
                var player = false;
                if (!err) {
                    try {
                        var pfn = this.playerVirtualPath(name, false);
                        player = efuns.findObject(pfn);
                        if (!player) {
                            player = efuns.loadObject(pfn, playerData);
                            ChatDaemon().broadcast('announce', '{0} has entered the game.'.fs(creator().displayName));
                        } else {
                            /* player loaded but linkdead */
                            ChatDaemon().broadcast('announce', '{0} has re-connected.'.fs(creator().displayName));
                            player().setClient(data.args.client);
                        }
                    }
                    catch (_e) {
                        console.log('Failure to load: %s', _e);
                        console.log(_e.stack);
                    }
                    cb.call(this, player);
                }

            });
        }
    }

    playerVirtualPath(name, creator) {
        return '/v/sys/data/{0}/{1}/{2}'.fs(creator ? 'creators' : 'players', name.charAt(0), name);
    }

    loadPlayerData(name, cb) {
        var self = this,
            cf = this.creatorFilename(name),
            pf = this.playerFilename(name);

        if (efuns.isFile(cf)) {
            return efuns.readJsonFile(cf, (playerData, err) => {
                return cb.call(this, playerData, err);
            });
        }
        else if (efuns.isFile(pf))
            return efuns.readJsonFile(pf, (playerData, err) => {
                return cb.call(this, playerData, err);
            });

        else {
            return cb.call(this, null, `No player exists by that name (${name})`);
        }
    }

    normalizeName(name) {
        return (name || '').toLowerCase().replace(/[^a-z]+/g, '');
    }

    playerExists(name, cb) {
        var self = this, fn = this.playerFilename(name);
        return fs.exists(fn, function (exists) {
            cb.call(self, exists, fn);
        }), this;
    }

    playerExistsSync(name) {
        return efuns.isFile(this.playerFilename(name));
    }

    playerFilename(name) {
        var unw = unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        var norm = this.normalizeName(name),
            playerFile = '/sys/data/players/{0}/{1}.json'.fs(norm.charAt(0), norm);
        return playerFile;
    }

    saveCreator(player, callback) {
        efuns.ifPermission(['COMMAND', player.getName()], () => {
            efuns.unguarded(() => {
                var fn = this.creatorFilename(player);
                efuns.writeJsonFile(fn, player.serializeObject(), callback);
            });
            return true;
        });
        return false;
    }

    savePlayer(player, callback) {
        efuns.ifPermission(['COMMAND', player.getName()], () => {
            efuns.unguarded(() => {
                var fn = this.playerFilename(player);
                efuns.mkdir(fn, function (err, dir) {
                    if (err) {
                        throw err;
                    } else {
                        efuns.writeFile(fn, player.exportData(), callback);
                    }
                });
            });
        });
    }
}


MUD.export(PlayerDaemon);
