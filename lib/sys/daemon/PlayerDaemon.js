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
    async createNewCharacter(data) {
        let vpath = await this.playerVirtualPath(data.name, AutoWiz),
            player = await efuns.objects.loadObjectAsync(vpath, data);

        ChatDaemon().broadcast('announce', `${player().displayName} has entered the world for the first time!`);

        if (AutoWiz)
            efuns.log('newplayers', `${player().displayName} [CREATOR] was created at ${(new Date().toUTCString())}`)
        else
            efuns.log('newplayers', `${player().displayName} was created at ${(new Date().toUTCString())}`)

        return player;
    }

    private async creatorFilename(name) {
        let unw = unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        let norm = this.normalizeName(name),
            creatorDirectory = `/sys/data/creators/${norm.charAt(0)}/`,
            creatorFile = `/sys/data/creators/${norm.charAt(0)}/${norm}.json`;

        await efuns.unguarded(async () => {
            await efuns.fs.createDirectoryAsync(creatorDirectory, MUDFS.MkdirFlags.EnsurePath)
                .catch(err => { throw err; });
        });
        return creatorFile;
    }

    async createWizard(_player) {
        if (thisPlayer && efuns.archp(thisPlayer)) {
            let player = unwrap(_player);
            return await this.saveCreator(player);
        }
    }

    async ensureSaveDirectoryExists() {
        let tp = thisPlayer();

        if (tp) {
            fn = tp.filename,
                dir = fn.slice(0, fn.lastIndexOf('/'));

            return await efuns.unguarded(async () => {
                return await efuns.fs.createDirectoryAsync(dir,
                    MUDFS.MkdirFlags.IgnoreExisting | MUDFS.MkdirFlags.EnsurePath);
            })
        }
        return false;
    }

    private async playerVirtualPath(name, creator) {
        let pname = this.normalizeName(name),
            dir = efuns.join('/sys/data/', creator ? 'creators' : 'players', '/', pname.charAt(0)),
            file = `${dir}/${pname}`;

        await efuns.unguarded(async () => await efuns.fs.createDirectoryAsync(dir));
        return file;
    }

    async loadPlayerData(name) {
        let cf = await this.creatorFilename(name),
            pf = await this.playerFilename(name);

        if (await efuns.fs.isFileAsync(cf) === true) {
            try {
                return await efuns.fs.readJsonAsync(cf)
                    .catch(err => { throw err; });
            }
            catch (err) {
                return false;
            }
        }
        else if (await efuns.fs.isFileAsync(pf) === true) {
            try {
                return efuns.fs.readJsonAsync(pf)
                    .catch(err => { throw err; });
            }
            catch (err) {
                return false;
            }
        }
        else {
            return false;
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
            throw `playerExists() requires valid callback parameter`;
        }
        let playerFile = this.playerFilename(name),
            creatorFile = await this.creatorFilename(name);

        if (name.startsWith('@')) {
            creatorFile = false;
            name = efuns.normalizeName(name.slice(1));
        }
        if (creatorFile) {
            let result = await efuns.fs.readJsonAsync(creatorFile);
            if (!efuns.isError(result)) {
                return callback ? callback(result) : result;
            }
        }
        if (playerFile) {
            let result = await efuns.fs.readJsonAsync(playerFile);

            if (!efuns.isError(result)) {
                return callback ? callback(result) : result;
            }
        }
        return callback ? callback(false) : false;
    }

    private async playerFilename(name) {
        let unw = unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        let norm = this.normalizeName(name),
            playerFile = `/sys/data/players/${norm.charAt(0)}/${norm}.json`;
        return playerFile;
    }

    async saveCreator(player) {
        return await this.savePlayer(player);
    }

    async savePlayer(player) {
        return await efuns.unguarded(async () => {
            let fn = await this.playerFilename(player),
                dir = fn.slice(0, fn.lastIndexOf('/')) + '/';

            if (await efuns.fs.createDirectoryAsync(dir)) {
                return await efuns.fs.writeJsonAsync(fn, player.serializeObject());
            }
        });
    }
}

module.exports = await createAsync(PlayerDaemon);
