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
        let prevObj = previousObject();

        let vpath = await this.playerVirtualPath(data.name, AutoWiz),
            player = await efuns.objects.loadObjectAsync(vpath, data);

        ChatDaemon().broadcast('announce', `${player().displayName} has entered the world for the first time!`);

        if (AutoWiz)
            await efuns.log('newplayers', `${player().displayName} [CREATOR] was created at ${(new Date().toUTCString())}`)
        else
            await efuns.log('newplayers', `${player().displayName} was created at ${(new Date().toUTCString())}`)

        return player;
    }

    private async creatorFilename(name, createDir=false) {
        let unw = typeof name !== 'string' && unwrap(name);

        if (unw) {
            name = unw.getName();
        }
        let norm = this.normalizeName(name),
            creatorDirectory = await efuns.fs.getFileAsync(`/sys/data/creators/${norm.charAt(0)}/`),
            creatorFile = await efuns.fs.getFileAsync(`/sys/data/creators/${norm.charAt(0)}/${norm}.json`);

        if (!creatorDirectory.exists && createDir === true)
            await efuns.unguarded(async () => await creatorDirectory.createDirectoryAsync(true));
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
            let fn = tp.filename,
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

    private async loadPlayerData(name) {
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
     * Check to see if a player exists
     * @param {string} name
     * @param {boolean} loadPlayer
     * @returns
     */
    async playerExistsAsync(name, loadPlayer = false) {
        let foobar = origin();
        let playerFile = await this.playerFilename(name),
            creatorFile = await this.creatorFilename(name);

        if (loadPlayer) {
            let prev = previousObject();
            if (!prev || !prev.filename.startsWith('/sys'))
                throw new Error('playerExistsAsync(): Permission denied');
        }
        if (name.startsWith('@')) {
            creatorFile = false;
            name = efuns.normalizeName(name.slice(1));
        }
        if (creatorFile && creatorFile.exists) {
            return loadPlayer ? await creatorFile.readJsonAsync() : true;
        }
        if (playerFile && playerFile.exists) {
            return loadPlayer ? await playerFile.readJsonAsync() : true;
        }
        return false;
    }

    private async playerFilename(name) {
        let unw = typeof name !== 'string' && unwrap(name);
        if (unw) {
            name = unw.getName();
        }
        let norm = this.normalizeName(name),
            playerFile = await efuns.fs.getFileAsync(`/sys/data/players/${norm.charAt(0)}/${norm}.json`);
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
