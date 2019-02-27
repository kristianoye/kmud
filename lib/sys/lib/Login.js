/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

$include('InputTypes');

const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Interactive = require(Base.Interactive),
    validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    PlayerDaemon = efuns.loadObjectSync(Daemon.Player),
    LoginTimeout = efuns.time.timespan('10 minutes');

class Login extends Interactive {
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

    private connect(clientPort, clientType) {
        if (clientType === 'html') {
            this.eventSend({
                eventType: 'loginSplash',
                eventData: '<img style="display:block; margin: 15px auto;" src="https://res.cloudinary.com/teepublic/image/private/s--lFpU0sV7--/t_Preview/b_rgb:191919,c_limit,f_jpg,h_630,q_90,w_630/v1466815268/production/designs/542927_2.jpg" />'
            });
        }
        else {
            writeLine(efuns.readFileSync('/sys/lib/Login.splash.txt'));
        }
        efuns.living.enableHeartbeat(true);
        this.enterUsername();
        return Object.assign(
            super.connect(clientPort, clientType),
            {
                allowEscaping: false
            });
    }

    private disconnect(reason) {
        reason && writeLine(reason);
        efuns.destruct(this);
    }

    private confirmTakeover(o, player) {
        let p = Object.assign({
            text: `${(player().displayName)} is already connected; Do you wish to take over? `,
            type: 'yes-no'
        });
        return prompt(p, resp => {
            if (yesp === 'yes') {
                efuns.unguarded(() => {
                    efuns.exec(this, player, () => {
                        this.destroy();
                    });
                });
            }
            else
                return this.enterUsername({ error: 'Please select a different username then.' });
        });
    }

    private enterPassword(name, playerData) {
        return prompt(InputTypePassword, 'Enter password: ', (pwd) => {
            if (pwd.length === 0) {
                this.client.close();
            }
            else if (!efuns.checkPassword(pwd, playerData.private['/base/Player'].player.password)) {
                writeLine('\nPassword incorrect!\n');
                this.enterPassword(name, playerData);
            }
            else {
                //  Player authenticated successfully
                let player = efuns.findPlayer(name);
                if (player) {
                    if (efuns.living.isConnected(player)) {
                        return this.confirmTakeover(name, player);
                    }
                    else {
                        efuns.unguarded(() => {
                            efuns.exec(this, player, () => {
                                this.destroy();
                                player.writeLine('Reconnected');
                            });
                        });
                    }
                }
                else {
                    player = efuns.restoreObject(playerData);
                    player && efuns.unguarded(() => {
                        efuns.exec(this, player, () => {
                            logger.log('Switching from Login to Player Instance');
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

        return prompt(InputTypeText, opts, async (name) => {
            if (name.length === 0) {
                writeLine('\nGood-bye!');
                return this.client.close();
            }
            await PlayerDaemon().playerExists(name, true, (player, error) => {
                if (error) {
                    writeLine('\nOops!  Something went wrong!  Try another name or come back again later!\n\n');
                    this.enterUsername();
                }
                else if (!player) 
                    prompt(InputTypeYesNo, { text: `Is ${name} the name you really want? `, default: 'yes' }, resp => {
                        if (resp !== 'yes') {
                            writeLine('\Enter the name you really want, then.\n\n');
                            return this.enterUsername();
                        }
                        else
                            return this.selectPassword({ name });
                    });
                else 
                    this.enterPassword(name, player);
            });
        });
    }

    get maxIdleTime() { return LoginTimeout; }

    private async selectPassword(playerData) {
        prompt(InputTypePassword, 'Select a password: ', async (pwd) => {
            var foo = 42;
            try {
                let [crypto, errors] = await efuns.createPasswordAsync(pwd);
                if (!errors)
                    this.confirmPassword(Object.assign(playerData, { password: crypto, plain: pwd }));
                else if (!Array.isArray(errors.list)) {
                    writeLine(`\n${errors.message}\n\n`);
                    this.selectPassword(playerData);
                }
                else {
                    writeLine(`\n${errors.list.join('\n')}\n\n`);
                    this.selectPassword(playerData);
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
                writeLine('\nPasswords do not match; Please try again.\n\n');
                this.selectPassword(playerData);
            }
            else {
                delete playerData.plain;
                this.selectGender(playerData);
            }
        });
    }

    private selectGender(playerData) {
        let opts = {
            text: 'Select a gender for your character: ', type: 'pickOne', options: {
                m: 'male',
                f: 'female',
                n: 'neutar',
                o: 'other'
            },
            summary: ',',
            prompt: 'Gender'
        };
        prompt(InputTypePickOne, opts, gender => {
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
        prompt('text', 'Enter real name (optional): ', name => {
            this.createNewCharacter(Object.assign(playerData, { realName: name }));
        });
    }

    private createNewCharacter(playerData) {
        let player = PlayerDaemon().createNewCharacter(Object.assign({}, {
            name: playerData.name,
        }, playerData));

        if (player) {
            logger.log('Creating new player');
            efuns.exec(this, player, (oldBody, newPlayer) => {
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

