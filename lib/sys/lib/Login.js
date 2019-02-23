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

    private connect(clientPort, clientType) {
        if (clientType === 'html') {
            this.eventSend({
                eventType: 'loginSplash',
                eventData: '<img style="display:block; margin: 15px auto;" src="https://res.cloudinary.com/teepublic/image/private/s--lFpU0sV7--/t_Preview/b_rgb:191919,c_limit,f_jpg,h_630,q_90,w_630/v1466815268/production/designs/542927_2.jpg" />'
            });
        }
        else {
            write(efuns.readFileSync('/sys/lib/Login.splash.txt'));
        }
        efuns.living.enableHeartbeat(true);
        this.enterUsername({});
        return Object.assign(
            super.connect(clientPort, clientType),
            {
                allowEscaping: false
            });
    }

    private disconnect(reason) {
        reason && write(reason);
        efuns.destruct(this);
    }

    private confirmTakeover(o, player) {
        let p = Object.assign({
            text: `${(player().displayName)} is already connected; Do you wish to take over? `,
            type: 'yesno'
        });
        return prompt(p, resp => {
            if (resp.toLowerCase().charAt(0) === 'y') {
                efuns.unguarded(() => {
                    efuns.exec(this, player, () => {
                        this.destroy();
                    });
                });
            }
            else if (resp.toLowerCase().charAt(0) === 'n') {
                return this.enterUsername({ error: 'Please select a different username then.' });
            }
        });
    }

    private enterPassword(playerData) {
        return prompt(InputTypePassword, 'Enter password: ', pwd => {
            if (pwd.length === 0) {
                this.client.close();
            }
            else if (!efuns.checkPassword(pwd, playerData.props.password)) {
                write('\nPassword incorrect!\n');
                this.enterPassword(playerData);
            }
            else {
                var player = efuns.findPlayer(playerData.props.name);
                if (player) {
                    if (player().connected) {
                        return this.confirmTakeover({}, player);
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
                PlayerDaemon().loadPlayer(playerData.props.name, {
                    props: playerData.props,
                    args: {
                        client: this.client
                    }
                }, player => {
                    efuns.unguarded(() => {
                        efuns.exec(this, player, () => {
                            logger.log('Switching from Login to Player Instance');
                            player().movePlayer('/world/sarta/Square', () => {
                                logger.log('Executing connect() on new player');
                            });
                        });
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

        return prompt(InputTypeText, opts, name => {
            if (name.length === 0) {
                write('Good-bye!');
                this.client.close();
            }
            else if (!PlayerDaemon().playerExistsSync(name)) {
                prompt(InputTypeYesNo, { text: `Is ${name} the name you really want? `, default: 'yes' }, resp => {
                    if (resp !== 'yes') {
                        write('\Enter the name you really want, then.\n\n');
                        return this.enterUsername({});
                    }
                    else
                        return this.selectPassword({ name: name });
                });
            }
            else {
                PlayerDaemon().loadPlayerData(name, (player, error) => {
                    if (!error && typeof player === 'object') {
                        this.enterPassword({ name: name }, player);
                    }
                    else {
                        this.enterUsername({ error: `Unable to load player data for ${name}, sorry!` });
                    }
                });
            }
        });
    }

    get maxIdleTime() { return LoginTimeout; }

    private async selectPassword(playerData) {
        prompt(InputTypePassword, 'Select a password: ', async (pwd) => {
            try {
                let [crypto, errors] = await efuns.createPasswordAsync(pwd);
                if (!errors)
                    this.confirmPassword(Object.assign(playerData, { password: crypto, plain: pwd }));
                else if (!Array.isArray(errors.list)) {
                    write(`\n${errors.message}\n\n`);
                    this.selectPassword(playerData);
                }
                else {
                    write(`\n${errors.list.join('\n')}\n\n`);
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
                write('\nPasswords do not match; Please try again.\n\n');
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
                write('\nInvalid gender choice; Please try again (you can change later)\n\n');
                this.selectGender(playerData);
            }
        });
    }

    private enterEmailAddress(playerData) {
        prompt('text', 'Enter e-mail address: ', email => {
            if (!validEmail.test(email)) {
                write('\nInvalid email address\n\n');
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
                    write('Oops, sorry.  Your body was not ready for you!  Tell someone to fix this.');
                    return efuns.destruct(this);
                }
                newPlayer.movePlayer('/world/sarta/Square');
            });
        }
    }
}

module.exports = Login;

