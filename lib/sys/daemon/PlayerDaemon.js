/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { CHAT_D } from '@Daemon';
import { LIB_CREATOR, LIB_PLAYER } from '@Base';

const
    ChatDaemon = await efuns.loadObjectAsync(CHAT_D),
    AutoWiz = efuns.featureEnabled('autoWiz');

export default singleton class PlayerDaemon extends MUDObject {
    /**
     * Check to see if autowiz is enabled on the specified port
     * TODO: Allow subnet/netmask validation of remote IP
     * @param {number} portNumber
     * @param {string} remoteAddress
     */
    autowizAvailable(portNumber, remoteAddress) {
        return true;
    }

    /**
     * Create a new character and place them in the game
     * @param {import('../lib/TextLogin').AccountObject} account
     * @param {import('../lib/TextLogin').PlayableObject} player
     * @returns
     */
    protected async createNewCharacter(account, player) {
        let vpath = await this.playerVirtualPath(player.playerName, player.isCreator),
            playerObject = await efuns.loadObjectAsync(vpath);

        playerObject.instance.keyId = player.playerName;
        playerObject.instance.gender = player.gender;
        playerObject.instance.race = player.playerRace;
        playerObject.instance.bodyType = 'human';

        return playerObject;
    }

    private async creatorFilename(name, createDir = false) {
        let unw = typeof name !== 'string' && unwrap(name);

        if (unw) {
            name = unw.getName();
        }
        let norm = this.normalizeName(name),
            creatorDirectory = await efuns.fs.getObjectAsync(`/sys/data/creators/${norm.charAt(0)}/`),
            creatorFile = await efuns.fs.getObjectAsync(`/sys/data/creators/${norm.charAt(0)}/${norm}.json`);

        if (!creatorDirectory.exists() && createDir === true)
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
                return await efuns.fs.createDirectoryAsync(dir, { createAsNeeded: true, errorIfExists: false });
            })
        }
        return false;
    }

    /**
     * Find or load a player
     * @param {string} name The name of the character to return
     * @param {boolean} isCreator If true, then only return creators
     * @returns
     */
    protected async findOrLoadPlayer(name, isCreator = false) {
        let userName = this.normalizeName(name),
            playerObject = !name.charAt(0) === '@' && isCreator ? efuns.living.findCreator(name) : efuns.living.findPlayer(name);

        if (playerObject)
            return playerObject;
        else
            playerObject = await this.loadPlayer(name, isCreator);

        return playerObject && playerObject.instance;
    }

    /**
     * Load a player
     * @param {string} name
     * @param {boolean} isCreator
     * @returns
     */
    protected async loadPlayer(name, isCreator = false) {
        name = this.normalizeName(name);
        let playerFile = await this.playerFilename(name),
            creatorFile = (isCreator === true || !name.startsWith('@')) && await this.creatorFilename(name);

        if (creatorFile && creatorFile.exists()) {
            let creator = await efuns.objects.loadObjectAsync({ file: creatorFile.baseName, isVirtual: true, args: [creatorFile.fullPath] });
            return creator;
        }
        else if (playerFile && playerFile.exists()) {
            let player = await efuns.objects.loadObjectAsync({ file: playerFile.baseName, isVirtual: true, args: [playerFile.fullPath] });
            return player;
        }
    }

    private async playerVirtualPath(name, creator) {
        let pname = this.normalizeName(name),
            dir = efuns.joinPath('/sys/data/', creator ? 'creators' : 'players', '/', pname.charAt(0)),
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
        if (creatorFile && creatorFile.exists()) {
            return loadPlayer ? await creatorFile.readJsonAsync() : true;
        }
        if (playerFile && playerFile.exists()) {
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
            playerFile = await efuns.fs.getObjectAsync(`/sys/data/players/${norm.charAt(0)}/${norm}.json`);
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
