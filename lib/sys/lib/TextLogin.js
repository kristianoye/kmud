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
    PlayerDaemon = await efuns.loadObjectAsync(Daemon.Player),
    LoginTimeout = efuns.time.timespan('10 minutes');

class TextLogin extends MUDObject {

    private getShellSettings() {
        return { allowEscaping: false };
    }

    private applyInputError(error) {
        let countDown = 10,
            timerId = setInterval(async () => {
                write('.');
                if (!countDown--) {
                    clearInterval(timerId);
                    await efuns.destruct(this);
                }
            });
        writeLine('\nUnable to complete login at this time; Please try again later.\n\n');
        write('Disconnecting in 10 seconds .');
    }

    private async connect() {
        let splash = await efuns.fs.readFileAsync('/sys/lib/Login.splash.txt');
        efuns.living.enableHeartbeat(true);
        writeLine(splash);
        this.enterUsername();
    }

    private async disconnect(reason) {
        reason && writeLine(reason);
        await efuns.destruct(this);
    }

    private confirmTakeover(player) {
        return prompt(Inputs.InputTypeYesNo, `${(player.displayName)} is already connected; Do you wish to take over? `, resp => {
            if (resp === 'yes') {
                efuns.unguarded(() => efuns.exec(this, player));
            }
            else {
                writeLine('\n\nPlease select a different username then.\n');
                return this.enterUsername();
            }
        });
    }

    private enterPassword(name, playerObject) {
        prompt(Inputs.InputTypePassword, 'Enter password: ', async pwd => {
            if (pwd.length === 0) {
                this.client.close();
            }
            else if (!playerObject.validatePassword(pwd)) {
                writeLine('\nPassword incorrect!\n');
                return true; // Recapture
            }
            else if (efuns.living.isConnected(playerObject)) {
                this.confirmTakeover(playerObject);
            }
            else if (typeof playerObject.environment !== 'object') {
                await efuns.unguarded(async () => {
                    await efuns.exec(this, playerObject, async () => {
                        await playerObject.movePlayerAsync(playerObject.environment || '/world/sarta/Square');
                    });
                });
            }
            else {
                await efuns.unguarded(async () => {
                    await efuns.exec(this, playerObject, async () => {
                        await efuns.destruct(this);
                        playerObject.writeLine('Reconnected');
                    });
                });
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
                let playerObject = await PLAYER_D->findOrLoadPlayer(name);

                if (!playerObject) {
                    //return this.confirmUsername(name);
                    let confirm = await promptAsync(Inputs.InputTypeYesNo, { text: `Is ${name} the name you really want? `, default: 'yes' });
                    if (confirm === 'yes') {
                        return this.selectPassword({ name });;
                    }
                    else {
                        writeLine('\Enter the name you really want, then.\n\n');
                        return true; // Recapture
                    }
                }
                else /* player exists */
                    return this.enterPassword(name, playerObject);
            }
            catch (err) {
                writeLine('\nOops!  Something went wrong!  Try another name or come back again later!\n\n');
            }
            return true; // Recapture
        });
    }

    get maxIdleTime() { return LoginTimeout; }

    private selectPassword(playerData) {
        prompt(Inputs.InputTypePassword, 'Select a password: ', async plain => {
            let errors, password = await efuns.createPasswordAsync(plain)
                .catch(e => { errors = e });
            if (!errors)
                return this.confirmPassword(Object.assign(playerData, { password, plain }));
            else if (!Array.isArray(errors.list)) {
                writeLine(`\n${errors.message}\n\n`);
                return this.selectPassword(playerData);
            }
            else {
                writeLine(`\n${errors.list.join('\n')}\n\n`);
                return this.selectPassword(playerData);
            }
        });
    }

    private confirmPassword(playerData) {
        prompt(Inputs.InputTypePassword, 'Confirm password: ', pwd => {
            if (playerData.plain !== pwd) {
                writeLine('\nPasswords do not match; Please try again.\n\n');
                this.selectPassword(playerData);
            }
            else {
                delete playerData.plain;
                this.selectGender(playerData);
            }
        });
    }

    private confirmUsername(name) {
        prompt(Inputs.InputTypeYesNo, { text: `Is ${name} the name you really want? `, default: 'yes' }, resp => {
            if (resp !== 'yes') {
                writeLine('\Enter the name you really want, then.\n\n');
                return this.enterUsername();
            }
            this.selectPassword({ name });
        });
    }

    private selectGender(playerData) {
        let opts = {
            text: 'Select a gender for your character: ',
            type: 'pickOne',
            options: {
                m: 'male',
                f: 'female',
                n: 'neutar',
                o: 'other'
            },
            summary: ',',
            prompt: 'Gender'
        };
        prompt(Inputs.InputTypePickOne, opts, gender => {
            if (gender) {
                this.enterEmailAddress(Object.assign(playerData, { gender }));
            }
            else {
                writeLine('\nInvalid gender choice; Please try again (you can change later)\n\n');
                this.selectGender(playerData);
            }
        });
    }

    private enterEmailAddress(playerData) {
        prompt('text', 'Enter e-mail address: ', email => {
            if (!validEmail.test(email)) {
                writeLine('\nInvalid email address\n\n');
                this.enterEmailAddress(playerData);
            }
            else {
                this.enterRealName(Object.assign(playerData, { email: email }));
            }
        });
    }

    private enterRealName(playerData) {
        prompt('text', 'Enter real name (optional): ', async name => {
            await this.createNewCharacter(Object.assign(playerData, { realName: name }));
        });
    }

    private async createNewCharacter(playerData) {
        let player = await PlayerDaemon().createNewCharacter(Object.assign({}, {
            name: playerData.name,
        }, playerData));

        if (player) {
            logger.log('Creating new player');
            await efuns.exec(this, player, async (oldBody, newPlayer) => {
                if (oldBody === newPlayer) {
                    writeLine('Oops, sorry.  Your body was not ready for you!  Tell someone to fix this.');
                    return await efuns.destruct(this);
                }
                await newPlayer->movePlayerAsync('/world/sarta/Square');
            });
        }
    }
}

module.defaultExport = TextLogin;

