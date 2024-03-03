/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */


import { PLAYER_D } from 'Daemon';

const
    Daemon = await requireAsync('Daemon'),
    Inputs = await requireAsync('InputTypes'),
    validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    PlayerDaemon = await efuns.objects.loadObjectAsync(Daemon.Player),
    LoginTimeout = efuns.time.timespan('10 minutes');

class HtmlLogin extends MUDObject {
    private getShellSettings() {
        return { allowEscaping: false };
    }

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

    private async connect() {
        efuns.living.enableHeartbeat(true);

        eventSend({
            type: 'windowHint',
            data: {
                mode: 'dialog',
                position: 'center'
            }
        });
        this.enterUsername();
    }

    private async disconnect(reason) {
        reason && writeLine(reason);
        efuns.destruct(this);
    }

    private async confirmTakeover(player) {
        return prompt(Inputs.InputTypeYesNo, `${(player.displayName)} is already connected; Do you wish to take over? `, async resp => {
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
                    await efuns.destruct(this);
                });
            }
            else {
                return this.enterUsername({
                    error: 'Please select a different username then'
                });
            }
        });
    }

    private enterPassword(name, playerData, opts = {}, attemptsLeft = 3) {
        opts = Object.assign({ text: 'Enter password: ' }, opts);

        prompt(Inputs.InputTypePassword, opts, async (pwd) => {
            if (!efuns.checkPassword(pwd, playerData.properties['/base/Player'].password)) {
                if (--attemptsLeft === 0) {
                    await destruct();
                }
                else
                    return this.enterPassword(name, playerData, { error: 'Password incorrect' }, attemptsLeft);
            }
            else {
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
                        return this.confirmTakeover(player);
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
                                await efuns.destruct(this);
                            });
                        });
                    }
                }
                else {
                    player = await PLAYER_D->loadPlayer(name);
                    if (player)
                        await efuns.unguarded(async () => {
                            logger.log('Switching from Login to Player Instance');
                            await efuns.exec(this, player, async () => {
                                eventSend({
                                    type: 'windowHint',
                                    data: {
                                        mode: 'normal',
                                        position: 'center'
                                    }
                                });
                                await player->movePlayerAsync(playerData.environment || '/world/sarta/Square', () => {
                                    logger.log('Executing connect() on new player');
                                });
                            });
                        });
                    else
                        throw 'Unable to restore player data';
                }
            }
        });
    }

    private enterUsername(playerData) {
        let opts = Object.assign({
            text: 'Enter your character name: ',
            maxLength: 20,
            maxLengthError: 'Your username cannot exceed 20 characters',
            minLength: 3,
            minLengthError: 'Your username must be at least 3 characters'
        }, playerData);

        prompt(Inputs.InputTypeText, opts, async name => {
            if (name.length === 0) {
                return this.client.close();
            }
            try {
                let player = await PLAYER_D->playerExistsAsync(name, true);

                if (!player) {
                    //return this.confirmUsername(name);
                    let confirm = await promptAsync(Inputs.InputTypeYesNo, { text: `Is ${name} the name you really want? `, default: 'yes' });
                    if (confirm === 'yes') {
                        return this.selectPassword({ name });
                    }
                    else {
                        writeLine('\Enter the name you really want, then.\n\n');
                        return true; // Recapture
                    }
                }
                else /* player exists */
                    return this.enterPassword(name, player);
            }
            catch (err) {
                writeLine('\nOops!  Something went wrong!  Try another name or come back again later!\n\n');
            }
            return true; // Recapture
        });
    }

    get maxIdleTime() { return LoginTimeout; }

    private selectPassword(playerData, opts = {}) {
        opts = Object.assign({ text: 'Select a password' }, opts);

        prompt(Inputs.InputTypePassword, opts, async (plain) => {
            try {
                let errors, password = await efuns.createPasswordAsync(plain)
                    .catch(e => { errors = e });
                if (!errors)
                    return this.confirmPassword(Object.assign(playerData, { password, plain }));
                else if (!Array.isArray(errors.list)) {
                    return this.selectPassword(playerData, { error: errors.message });
                }
                else {
                    return this.selectPassword(playerData, { error: errors.list });
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
                return this.selectPassword(playerData, { error: 'Passwords do not match; Please try again.' });
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
                return this.enterEmailAddress(Object.assign(playerData, { gender }));
            }
            else {
                return this.selectGender(playerData, { error: 'Invalid gender choice; Please try again (you can change later)' });
            }
        });
    }

    private enterEmailAddress(playerData, opts = {}) {
        opts = Object.assign({ text: 'Enter e-mail address' }, opts);
        prompt('text', opts, email => {
            if (!validEmail.test(email)) {
                return this.enterEmailAddress(playerData, { error: 'Invalid email address' });
            }
            else {
                return this.enterRealName(Object.assign(playerData, { emailAddress: email }));
            }
        });
    }

    private async enterRealName(playerData) {
        prompt('text', 'Enter real name (optional): ', async name => {
            await this.createNewCharacter(Object.assign(playerData, { realName: name }));
        });
    }

    private async createNewCharacter(playerData) {
        let player = await PLAYER_D->createNewCharacter(Object.assign({}, {
            name: playerData.name,
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
                    return await efuns.destruct(this);
                }
                await newPlayer->movePlayerAsync('/world/sarta/Square');
            });
        }
    }
}

module.defaultExport = HtmlLogin;

