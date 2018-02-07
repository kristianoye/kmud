var ChatDaemon,
    AutoWiz = false;

class PlayerDaemon extends MUDObject {
    create() {
        ChatDaemon = efuns.loadObject('/daemon/ChatDaemon');
        AutoWiz = efuns.featureEnabled('autoWiz');
    }

    createAdmin(evt) {
        if (efuns.gameState() < 3) {
            let fn = this.creatorFilename(evt.eventUsername);
            let props = {
                props: {
                    name: evt.eventUsername,
                    password: evt.eventPassword
                },
                $protected: {
                    password: evt.eventPassword
                }
            };
            efuns.writeJsonFile(fn, props);
            return;
        }
        throw new Error(`Illegal attempt to create admin account.`);
    }

    createNewCharacter(data, callback) {
        var vpath = this.playerVirtualPath(data.name, AutoWiz),
            client = data.args.client,
            isWizard = AutoWiz && master().addToGroup('$wizard', data.name),
            player = efuns.loadObject(vpath, data);
        try {
            ChatDaemon().broadcast('announce', `${player().displayName} has entered the world for the first time!`);
            return player;
        }
        catch (err) {
            player = false;
        }
        return player;
    }

    creatorFilename(name) {
        var unw = unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        var norm = this.normalizeName(name),
            creatorDirectory = `/sys/data/creators/${norm.charAt(0)}/`,
            creatorFile = `/sys/data/creators/${norm.charAt(0)}/${norm}.json`;

        efuns.unguarded(() => {
            efuns.mkdir(creatorDirectory, {
                flags: MkdirFlags.EnsurePath
            });
        });
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
                            ChatDaemon().broadcast('announce', `${(creator().displayName)} has entered the game.`);
                        } else {
                            ChatDaemon().broadcast('announce', `${(creator().displayName)} has re-connected.`);
                        }
                    }
                    catch (_e) {
                        logger.log('Failure to load: %s', _e);
                        logger.log(_e.stack);
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
                    cb.call(this, player);
                }

            });
        }
    }

    playerVirtualPath(name, creator) {
        let pname = this.normalizeName(name),
            dir = `/sys/data/${(creator ? 'creators' : 'players')}/${pname.charAt(0)}/`,
            file = `/v${dir}/${pname}`;
        efuns.unguarded(() => {
            efuns.mkdir(dir);
        });
        return file;
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
        var self = this,
            fn = this.playerFilename(name),
            cfn = this.creatorFilename(name);

        return fs.exists(cfn, function (exists) {
            if (exists) {
                cb.call(self, exists, fn);
            }
            else {
                return fs.exists(fn, function (exists) {
                    cb.call(self, exists, fn);
                }), this;
            }
        });
    }

    playerExistsSync(name) {
        return efuns.isFile(this.playerFilename(name)) ||
            efuns.isFile(this.creatorFilename(name));
    }

    playerFilename(name) {
        var unw = unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        var norm = this.normalizeName(name),
            playerFile = `/sys/data/players/${norm.charAt(0)}/${norm}.json`;
        return playerFile;
    }

    saveCreator(player, callback) {
        efuns.unguarded(() => {
            var fn = this.creatorFilename(player);
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


MUD.export(PlayerDaemon);
