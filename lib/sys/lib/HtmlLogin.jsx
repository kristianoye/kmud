/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

$include('InputTypes');

const
    Daemon = require('Daemon'),
    validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    PlayerDaemon = efuns.loadObjectSync(Daemon.Player),
    LoginTimeout = efuns.time.timespan('10 minutes');

class Login extends MUDObject {
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

    private confirmTakeover(player) {
        return prompt(InputTypeYesNo, `${(player.displayName)} is already connected; Do you wish to take over? `, resp => {
            if (resp === 'yes') {
                efuns.unguarded(() => {
                    eventSend({
                        type: 'windowHint',
                        data: {
                            mode: 'normal',
                            position: 'center'
                        }
                    });
                    efuns.exec(this, player);
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

    private enterPassword(name, playerData, opts = {}) {
        opts = Object.assign({ text: 'Enter password: ' }, opts);
        return prompt(InputTypePassword, opts, (pwd) => {
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
                        efuns.unguarded(() => {
                            efuns.exec(this, player, () => {
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
                    player = efuns.restoreObject(playerData);
                    player && efuns.unguarded(() => {
                        efuns.exec(this, player, () => {
                            logger.log('Switching from Login to Player Instance');
                            eventSend({
                                type: 'windowHint',
                                data: {
                                    mode: 'normal',
                                    position: 'center'
                                }
                            });
                            player.movePlayer(playerData.environment || '/world/sarta/Square', () => {
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

        return prompt(InputTypeText, opts, /** @param {string} name */ async (name) => {
            if (name.length === 0) {
                return efuns.destruct(this);
            }
            await PlayerDaemon().playerExists(name, true, (player, error) => {
                if (error) {
                    this.enterUsername({ error: 'Something went wrong; Try another name or come back again later.' });
                }
                else if (!player) 
                    prompt(InputTypeYesNo, { text: `Is ${name} the name you really want? `, default: 'yes' }, resp => {
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
        prompt(InputTypePassword, opts, async (plain) => {
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
        prompt(InputTypePassword, 'Confirm password: ', pwd => {
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
        prompt(InputTypePickOne, opts, gender => {
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

    private enterRealName(playerData) {
        prompt('text', 'Enter real name (optional): ', name => {
            this.createNewCharacter(Object.assign(playerData, { realName: name }));
        });
    }

    private createNewCharacter(playerData) {
        let player = PlayerDaemon().createNewCharacter(Object.assign({}, {
            name: playerData.keyId,
        }, playerData));

        if (player) {
            logger.log('Creating new player');
            efuns.exec(this, player, (oldBody, newPlayer) => {
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
                newPlayer.movePlayer('/world/sarta/Square');
            });
        }
    }
}

module.exports = Login;

