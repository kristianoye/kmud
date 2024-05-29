/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Provides simple authentication token creation and validation.
 */
const
    crypto = require('crypto'),
    path = require('path'),
    fs = require('fs');

function createRandomKey(byteSize = 32) {
    let randomBits = Buffer.alloc(byteSize);
    crypto.randomFillSync(randomBits, 0, byteSize);
    return randomBits.toString('base64');
}

function loadOrCreateKey(keyFile, keySize = 32) {
    let fullPath = path.join(__dirname, keyFile);

    if (!fs.existsSync(fullPath)) {
        let key = createRandomKey(Math.max(keySize, 32));
        fs.writeFileSync(fullPath, key);
        return key;
    }
    let content = fs.readFileSync(fullPath);
    return content.toString('utf8').trim();
}

class AuthManager {
    constructor(config = {}) {
        this.cryptoAlgorithm = config.cryptoAlgorithm || 'aes-256-ctr';
        this.cryptoKey = config.cryptoKey;

        if (!this.cryptoKey) {
            this.cryptoKey = loadOrCreateKey(
                config.cryptoKeyFile || 'MachineKey.dat',
                config.cryptoKeySize);
        }
        if (typeof this.cryptoKey === 'string') {
            this.cryptoKey = Buffer.from(this.cryptoKey, 'base64');
        }
        Object.freeze(this);
    }

    /**
     * Create an auth token
     * @param {string} username
     * @param {string} password
     * @param {Buffer} iv Optional initialization vector
     * @returns
     */
    create(username, password, iv = false) {
        if (iv === false) {
            iv = Buffer.alloc(16);
            iv = Buffer.from(Array.prototype.map.call(iv, () => { return Math.floor(Math.random() * 256) }));
        }
        let criptor = crypto.createCipheriv(this.cryptoAlgorithm, this.cryptoKey, iv);
        let cryptoText = criptor.update(JSON.stringify({
            username,
            password
        }), 'utf8', 'base64');

        cryptoText += criptor.final('base64');
        cryptoText += '::' + Buffer.from(iv).toString('base64');

        return cryptoText;
    }

    /**
     * Decrypt an auth token
     * @param {string} cryptoChunk
     * @returns
     */
    decrypt(cryptoChunk) {
        try {
            let [cryptoText, ivText] = cryptoChunk.split('::', 2);
            let iv = Buffer.from(ivText, 'base64');
            let criptor = crypto.createCipheriv(this.cryptoAlgorithm, this.cryptoKey, iv);
            let decrypted = criptor.update(cryptoText, 'base64', 'utf8');

            decrypted += criptor.final('utf8');

            let result = JSON.parse(decrypted);
            return result;
        }
        catch (err) {
            console.log(`Error in AuthManager: ${err}: ${cryptoText}`);
        }
        return false;
    }
}

module.exports = AuthManager;

