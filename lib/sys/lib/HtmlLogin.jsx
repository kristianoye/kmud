﻿/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

const
    Daemon = await requireAsync('Daemon'),
    Inputs = await requireAsync('InputTypes'),
    validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    PlayerDaemon = await efuns.objects.loadObjectAsync(Daemon.Player),
    LoginTimeout = efuns.time.timespan('10 minutes');

class HtmlLogin extends MUDObject {
    get allowInputEscape() { return false; }

    private applyInputError(error) {
        let countDown = 10,
            timerId = setInterval(() => {
                write('.');
                if (!countDown--) {
                    clearInterval(timerId);
                    efuns.destruct(this);
                }
            });
        writeLine('\nUnable to complete login at this time; Please try again later.\n\n');
        write('Disconnecting in 10 seconds .');
    }

    private connect() {
        efuns.living.enableHeartbeat(true);

        eventSend({
            type: 'windowHint',
            data: {
                mode: 'dialog',
                position: 'center'
            }
        });
        this.enterUsername();
        return { allowEscaping: false };
    }

    private disconnect(reason) {
        reason && writeLine(reason);
        efuns.destruct(this);
    }

    private async confirmTakeover(player) {
        return await prompt(Inputs.InputTypeYesNo, `${(player.displayName)} is already connected; Do you wish to take over? `, async resp => {
            if (resp === 'yes') {
                await efuns.unguarded(async () => {
                    eventSend({
                        type: 'windowHint',
                        data: {
                            mode: 'normal',
                            position: 'center'
                        }
                    });
                    await efuns.exec(this, player);
                    efuns.destruct(this);
                });
            }
            else {
                return this.enterUsername({
                    error: 'Please select a different username then'
                });
            }
        });
    }

    private async enterPassword(name, playerData, opts = {}) {
        opts = Object.assign({ text: 'Enter password: ' }, opts);
        return prompt(Inputs.InputTypePassword, opts, async (pwd) => {
            if (pwd.length === 0) {
                this.client.close();
            }
            else if (!efuns.checkPassword(pwd, playerData.properties['/base/Player'].password)) {
                this.enterPassword(name, playerData, { error: 'Password incorrect' });
            }
            else {
                //  Player authenticated successfully
                let player = efuns.living.findPlayer(name);

                eventSend({
                    type: 'windowAuth',
                    data: {
                        username: efuns.normalizeName(name),
                        password: playerData.properties['/base/Player'].password
                    }
                });

                if (player) {
                    if (efuns.living.isConnected(player)) {
                        this.confirmTakeover(player);
                    }
                    else {
                        await efuns.unguarded(async () => {
                            await efuns.exec(this, player, async () => {
                                eventSend({
                                    type: 'windowHint',
                                    data: {
                                        mode: 'normal',
                                        position: 'center'
                                    }
                                });
                                player.writeLine('Reconnected');
                                efuns.destruct(this);
                            });
                        });
                    }
                }
                else {
                    player = await efuns.restoreObjectAsync(playerData);
                    player && await efuns.unguarded(async () => {
                        logger.log('Switching from Login to Player Instance');
                        await efuns.exec(this, player, async () => {
                            eventSend({
                                type: 'windowHint',
                                data: {
                                    mode: 'normal',
                                    position: 'center'
                                }
                            });
                            await player.movePlayerAsync(playerData.environment || '/world/sarta/Square', () => {
                                logger.log('Executing connect() on new player');
                            });
                        });
                    });
                }
            }
        });
    }

    private async enterUsername(playerData) {
        let opts = Object.assign({
            text: 'Enter your character name: ',
            maxLength: 20,
            maxLengthError: 'Your username cannot exceed 20 characters',
            minLength: 3,
            minLengthError: 'Your username must be at least 3 characters'
        }, playerData);

        return prompt(Inputs.InputTypeText, opts, /** @param {string} name */ async (name) => {
            if (name.length === 0) {
                return efuns.destruct(this);
            }
            await PlayerDaemon().playerExists(name, true, (player, error) => {
                if (error) {
                    this.enterUsername({ error: 'Something went wrong; Try another name or come back again later.' });
                }
                else if (!player) 
                    prompt(Inputs.InputTypeYesNo, { text: `Is ${name} the name you really want? `, default: 'yes' }, resp => {
                        if (resp !== 'yes') {
                            return this.enterUsername({ error: 'Enter the name you really want, then.' });
                        }
                        else
                            return this.selectPassword({ displayName: name, keyId: efuns.normalizeName(name) });
                    });
                else 
                    this.enterPassword(name, player);
            });
        });
    }

    get maxIdleTime() { return LoginTimeout; }

    private async selectPassword(playerData, opts = {}) {
        opts = Object.assign({ text: 'Select a password' }, opts);
        prompt(Inputs.InputTypePassword, opts, async (plain) => {
            try {
                let errors, password = await efuns.createPasswordAsync(plain)
                    .catch(e => { errors = e });
                if (!errors)
                    this.confirmPassword(Object.assign(playerData, { password, plain }));
                else if (!Array.isArray(errors.list)) {
                    this.selectPassword(playerData, { error: errors.message });
                }
                else {
                    this.selectPassword(playerData, { error: errors.list });
                }
            }
            catch (wtf) {
                console.log(wtf);
            }
        });
    }

    private confirmPassword(playerData) {
        prompt(Inputs.InputTypePassword, 'Confirm password: ', pwd => {
            if (playerData.plain !== pwd) {
                this.selectPassword(playerData, { error: 'Passwords do not match; Please try again.' });
            }
            else {
                delete playerData.plain;
                this.selectGender(playerData);
            }
        });
    }

    private selectGender(playerData, opts = {}) {
        opts = Object.assign({
            text: 'Select a gender for your character: ', type: 'pickOne', options: {
                m: 'male',
                f: 'female',
                n: 'neutar',
                o: 'other'
            },
            summary: ',',
            prompt: 'Gender'
        }, opts);
        prompt(Inputs.InputTypePickOne, opts, gender => {
            if (gender) {
                this.enterEmailAddress(Object.assign(playerData, { gender }));
            }
            else {
                this.selectGender(playerData, { error: 'Invalid gender choice; Please try again (you can change later)' });
            }
        });
    }

    private enterEmailAddress(playerData, opts = {}) {
        opts = Object.assign({ text: 'Enter e-mail address' }, opts);
        prompt('text', opts, email => {
            if (!validEmail.test(email)) {
                this.enterEmailAddress(playerData, { error: 'Invalid email address' });
            }
            else {
                this.enterRealName(Object.assign(playerData, { emailAddress: email }));
            }
        });
    }

    private async enterRealName(playerData) {
        await prompt('text', 'Enter real name (optional): ', async name => {
            await this.createNewCharacterAsync(Object.assign(playerData, { realName: name }));
        });
    }

    private async createNewCharacter(playerData) {
        let player = await PlayerDaemon().createNewCharacter(Object.assign({}, {
            name: playerData.keyId,
        }, playerData));

        if (player) {
            logger.log('Creating new player');
            await efuns.exec(this, player, async (oldBody, newPlayer) => {
                eventSend({
                    type: 'windowHint',
                    data: {
                        mode: 'normal',
                        position: 'center'
                    }
                });
                if (oldBody === newPlayer) {
                    writeLine('Oops, sorry.  Your body was not ready for you!  Tell someone to fix this.');
                    return efuns.destruct(this);
                }
                await newPlayer.movePlayerAsync('/world/sarta/Square');
            });
        }
    }
}

module.defaultExport = HtmlLogin;

