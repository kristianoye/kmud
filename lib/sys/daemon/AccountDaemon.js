/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

/**
 * @typedef {Object} PlayableObject
 * @property {string} playerName
 * @property {string} playerFile
 * @property {number} lastPlayed
 * @property {string} displayText
 * @property {boolean} enabled
 * @property {string} disabledReason
 * @property {boolean} isCreator
 * 
 * @typedef {Object} AccountObject
 * @property {string} accountName
 * @property {boolean} banned
 * @property {number} createDate
 * @property {number} lastLogin
 * @property {string} emailAddress
 * @property {string} password
 * @property {PlayableObject[]} players
 * @property {string} realName
 * @property {boolean} require2FA
 */

import { DIR_ACCOUNT } from '@Dirs';
import { PLAYER_D } from '@Daemon';

const
    PlayerDaemon = await efuns.loadObjectAsync(PLAYER_D);

export default singleton class AccountDaemon {
    /**
     * See if a particular account exists
     * @param {string} name The account name to check
     * @returns {Promise<boolean>}
     */
    protected async accountExists(name) {
        /** @type {string} */
        let accountFilename = this.getAccountPath(name),
            accountFile = await efuns.fs.getObjectAsync(accountFilename);
        return accountFile.exists();
    }

    /**
     * Authenticate an account login request
     * @param {string} accountName The username to authenticate
     * @param {string} pwd The encrypted password
     * @returns
     */
    protected async authenticate(accountName, pwd) {
        try {
            let data = await this.loadAccountInfo(accountName);
            if (efuns.checkPassword(pwd, data.password)) {
                return data;
            }
        }
        catch (err) {
            await efuns.logError(err);
        }
        return false;
    }

    /**
     * Create a new account
     * @param {Partial<AccountObject>} accountInfo
     * @returns {AccountObject|false}
     */
    protected async createAccount(accountInfo) {
        if (!await this.accountExists(accountInfo.accountName)) {
            try {
                let accountData = {
                    accountName: accountInfo.accountName,
                    banned: false,
                    createDate: Date.now,
                    lastLogin: Date.now,
                    emailAddress: accountInfo.emailAddress,
                    password: accountInfo.password,
                    players: [],
                    realName: accountInfo.realName,
                    require2FA: false
                };
                let [filename, dirName] = this.getAccountPath(accountInfo.accountName, true),
                    baseDir = await efuns.fs.getObjectAsync(dirName);

                if (!baseDir.exists())
                    await baseDir.createDirectoryAsync();

                let dataFile = await efuns.fs.getObjectAsync(filename);
                await dataFile.writeJsonAsync(accountData);
                return accountData;
            }
            catch (err) {
                await efuns.logError(err);
            }
        }
        return false;
    }

    /**
     * Create new character and place them in the world.
     * @param {AccountObject} account
     * @param {PlayableObject} player
     */
    protected async createNewCharacter(account, player) {
        try {
            let playerObject = await PlayerDaemon().createNewCharacter(account, player);
            account.players.push(player);
            await this.saveAccount(account);
            return playerObject;
        }
        catch (err) {
            await efuns.logError(err);
            return false;
        }
    }

    /**
     * Get the path used to store an account file
     * @param {string} name
     * @param {boolean} includeDir
     * @returns
     */
    protected getAccountPath(name, includeDir = false) {
        /** @type {string} */
        let accountName = efuns.normalizeName(name),
            baseDirName = DIR_ACCOUNT + `/${accountName.charAt(0)}`,
            accountFilename = `/${baseDirName}/${accountName}.json`;

        if (includeDir)
            return [accountFilename, baseDirName];
        else
            return accountFilename;
    }

    /**
     * Attempt to load an account
     * @param {string} accountName
     * @returns {Promise<AccountObject | false>}
     */
    protected async loadAccountInfo(accountName) {
        let filename = this.getAccountPath(accountName),
            accountFile = await efuns.fs.getObjectAsync(filename);

        if (accountFile.exists()) {
            /** @type {AccountObject} */
            let account = await accountFile.readJsonAsync();

            //  Prune missing characters
            if (account.players.length) {
                let validPlayers = [];
                for (const player of account.players) {
                    if (await PlayerDaemon().playerExistsAsync(player.playerName))
                        validPlayers.push(player);
                }
                if (validPlayers.length !== account.players.length) {
                    account.players = validPlayers;
                    await this.saveAccount(account);
                }
            }
            return account;
        }

        return false;
    }

    /**
     * Save an account object 
     * @param {AccountObject} account
     */
    protected async saveAccount(account) {
        try {
            let [filename, dirname] = this.getAccountPath(account.accountName, true),
                saveDir = await efuns.fs.getObjectAsync(dirname);

            if (!saveDir.exists())
                await saveDir.createDirectoryAsync();

            let saveFile = await efuns.fs.getObjectAsync(filename);
            await saveFile.writeJsonAsync(account);
            return true;
        }
        catch (err) {
            await efuns.logError(err);
        }
        return false;
    }
}
