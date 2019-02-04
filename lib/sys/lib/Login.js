/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Interactive = require(Base.Interactive),
    validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    PlayerDaemon = efuns.loadObject(Daemon.Player);

class Login extends Interactive {
    connect(clientPort, clientType) {
        if (clientType === 'html') {
            this.eventSend({
                eventType: 'loginSplash',
                eventData: '<img style="display:block; margin: 15px auto;" src="https://res.cloudinary.com/teepublic/image/private/s--lFpU0sV7--/t_Preview/b_rgb:191919,c_limit,f_jpg,h_630,q_90,w_630/v1466815268/production/designs/542927_2.jpg" />'
            });
        }
        else {
            write(efuns.readFile('/sys/lib/Login.splash.txt'));
        }
        this.enterUsername({ drawPrompt: true });
    }

    confirmTakeover(o, player) {
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

    enterPassword(o, playerData) {
        let input = Object.assign({ text: 'Enter password: ', type: 'password', name: 'Password' }, o || {});
        return prompt(input, pwd => {
            if (pwd.length === 0) {
                this.client.close();
            }
            else if (!efuns.checkPassword(pwd, playerData.props.password)) {
                this.enterPassword({ error: 'Password incorrect!' }, playerData);
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
                            player().movePlayer('/world/sarta/square', () => {
                                logger.log('Executing connect() on new player');
                            });
                        });
                    });
                });
            }
        });
    }

    enterUsername(o) {
        let p = Object.assign({ text: 'Enter your character name: ', name: 'Username' }, o || {});
        return prompt(p, name => {
            if (name.length === 0) {
                write('Good-bye!');
                this.client.close();
            }
            else if (name.length < 3) {
                this.enterUsername({ error: 'Your username must be at least 3 characters' });
            }
            else if (!PlayerDaemon().playerExistsSync(name)) {
                prompt({ text: `Is ${name} the name you really want? `, type: 'yesno', name: 'ConfirmName' }, resp => {
                    if (resp.toLowerCase().substr(0, 1) !== 'y')
                        return this.enterUsername({ error: 'Enter the name you really want, then' });
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

    async selectPassword(req, o) {
        let input = Object.assign({ text: 'Select a password: ', name: 'Password', type: 'password' }, o || {});
        prompt(input, async (pwd) => {
            //efuns.createPassword(pwd, (crypto, /** @type {string[]} */ errors) => {
            //    if (errors.length === 0)
            //        this.confirmPassword(Object.assign(req, { password: crypto, plain: pwd }));
            //    else 
            //        this.selectPassword(req, { 'error': errors.join('\n') });
            //});
            let errors = [];
            let crypto = await efuns.createPasswordAsync(pwd).catch(e => { errors = e; });
            
            if (errors.length === 0)
                this.confirmPassword(Object.assign(req, { password: crypto, plain: pwd }));
            else
                this.selectPassword(req, { 'error': errors.join('\n') });
        });
    }

    confirmPassword(req, o) {
        let p = Object.assign(o || {}, { text: 'Confirm password: ', name: 'Password', type: 'password' });
        prompt(p, pwd => {
            if (req.plain !== pwd) {
                this.selectPassword(req, { error: 'Passwords do not match; Please try again.' });
            }
            else {
                delete req.plain;
                this.enterEmailAddress(req);
            }
        });
    }

    enterEmailAddress(req, o) {
        let p = Object.assign(o || {}, { text: 'Enter e-mail address: ', name: 'EmailAddress' });
        prompt(p, email => {
            if (!validEmail.test(email)) {
                this.enterEmailAddress(req, { error: 'Invalid e-mail address.' });
            }
            else {
                this.enterRealName(Object.assign(req, { email: email }));
            }
        });
    }

    enterRealName(req, o) {
        let p = Object.assign(o || {}, { text: 'Enter real name (optional): ', name: 'RealName' });
        prompt(p, name => {
            this.createNewCharacter(Object.assign(req, { realName: name }));
        });
    }

    createNewCharacter(req) {
        var player = PlayerDaemon().createNewCharacter({
            name: req.name,
            props: req,
            args: {
                client: this.client
            }
        });
        if (player) {
            logger.log('Creating new player');
            efuns.exec(this, player, () => {
                player().movePlayer('/world/sarta/square');
            });
        }
    }
}

module.exports = Login;

