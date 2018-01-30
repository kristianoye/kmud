MUD.imports('/base/Interactive');

const validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

var PlayerDaemon = efuns.loadObject('/sys/daemon/PlayerDaemon');

class Login extends Interactive {
    connect(client) {
        if (efuns.hasBrowser(this)) {
            this.eventSend({
                eventType: 'loginSplash',
                eventData: '<img style="display:block; margin: 15px auto;" src="https://res.cloudinary.com/teepublic/image/private/s--lFpU0sV7--/t_Preview/b_rgb:191919,c_limit,f_jpg,h_630,q_90,w_630/v1466815268/production/designs/542927_2.jpg" />'
            });
        }
        else {
            write(efuns.readFile('/sys/lib/Login.splash.txt'));
        }
        this.enterUsername();
    }

    confirmTakeover(o, player) {
        var p = efuns.merge({
            text: `${(player().displayName)} is already connected; Do you wish to take over? `,
            type: 'yesno'
        }), self = this;
        return efuns.addPrompt(p, resp => {
            if (resp.toLowerCase().charAt(0) === 'y') {
                efuns.unguarded(() => {
                    efuns.exec(this, player, () => {
                        this.destroy();
                    });
                });
            }
            else if (resp.toLowerCase().charAt(0) === 'n') {
                return self.enterUsername({ error: 'Please select a different username then.' });
            }
        });
    }

    enterPassword(o, playerData) {
        var p = efuns.merge({ text: 'Enter password: ', type: 'password', name: 'Password' }), self = this;
        return efuns.addPrompt(p, function (pwd) {
            if (pwd.length === 0) {
                this.client.close();
            }
            else if (!efuns.checkPassword(pwd, playerData.props.password)) {
                self.enterPassword({ error: 'Password incorrect' }, playerData);
            }
            else {
                var player = efuns.findPlayer(playerData.props.name);
                if (player) {
                    if (player().connected) {
                        return self.confirmTakeover({}, player);
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
                }, (player) => {
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
        var p = efuns.merge({ text: 'Enter your character name: ', name: 'Username' }, o), self = this;
        return efuns.addPrompt(p, function (name) {
            if (name.length === 0) {
                this.write('Good-bye!');
                this.client.close();
            }
            else if (name.length < 3) {
                this.enterUsername({ error: 'Your username must be at least 3 characters' });
            }
            else if (!PlayerDaemon().playerExistsSync(name)) {
                self.client.addPrompt({ text: `Is ${name} the name you really want? `, type: 'yesno', name: 'ConfirmName' }, function (resp) {
                    if (resp.toLowerCase().substr(0, 1) !== 'y') return this.enterUsername({ error: 'Enter the name you really want, then' });
                    else return this.selectPassword({ name: name });
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

    selectPassword(req, o) {
        var p = efuns.merge({ text: 'Select a password: ', name: 'Password', type: 'password' }, o);
        efuns.addPrompt(p, function (pwd) {
            efuns.createPassword(pwd, (/* encrypted password */ crypto, /** @type {string[] */ errors) => {
                if (errors.length === 0)
                    this.confirmPassword(efuns.merge(req, { password: crypto, plain: pwd }));
                else 
                    this.selectPassword(req, { 'error': errors.join('\n') });
            });
        });
    }

    confirmPassword(req, o) {
        var p = efuns.merge({ text: 'Confirm password: ', name: 'Password', type: 'password' }, o);
        efuns.addPrompt(p, function (pwd) {
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
        var p = efuns.merge({ text: 'Enter e-mail address: ', name: 'EmailAddress' }, o);
        efuns.addPrompt(p, function (email) {
            if (!validEmail.test(email)) {
                this.enterEmailAddress(req, { error: 'Invalid e-mail address.' });
            }
            else {
                this.enterRealName(efuns.merge(req, { email: email }));
            }
        });
    }

    enterRealName(req, o) {
        var p = efuns.merge({ text: 'Enter real name (optional): ', name: 'RealName' }, o);
        efuns.addPrompt(p, function (name) {
            this.createNewCharacter(efuns.merge(req, { realName: name }));
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

MUD.export(Login);
