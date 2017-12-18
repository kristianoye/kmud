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
            this.client.write(efuns.readFile('/sys/lib/Login.splash.txt'));
        }
        this.enterUsername();
    }

    confirmTakeover(o, player) {
        var p = Object.extend({
            text: '{0} is already connected; Do you wish to take over? '.fs(player().displayName.ucfirst()),
            type: 'yesno'
        }), self = this;
        return this.client.addPrompt(p, resp => {
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
        var p = Object.extend({ text: 'Enter password: ', type: 'password', name: 'Password' }), self = this;
        return this.client.addPrompt(p, function (pwd) {
            if (pwd.length === 0) {
                this.client.close();
            }
            else if (playerData.props.password !== pwd) {
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
                            console.log('Switching from Login to Player Instance');
                            player().movePlayer('/world/sarta/square', function () {
                                console.log('Executing connect() on new player');
                            });
                        });
                    });
                });
            }
        });
    }

    enterUsername(o) {
        var p = Object.extend({ text: 'Enter your character name: ', name: 'Username' }, o), self = this;
        return this.client.addPrompt(p, function (name) {
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
                        this.enterUsername({ error: 'Unable to load player data for {0}, sorry!'.fs(name) });
                    }
                });
            }
        });
    }

    selectPassword(req, o) {
        var p = Object.extend({ text: 'Select a password: ', name: 'Password', type: 'password' }, o);
        this.client.addPrompt(p, function (pwd) {
            efuns.createPassword(pwd, (/* encrypted password */ crypto, /** @type {string[] */ errors) => {
                if (errors.length === 0)
                    this.confirmPassword(Object.extend(req, { password: crypto, plain: pwd }));
                else 
                    this.selectPassword(req, { 'error': errors.join('\n') });
            });
        });
    }

    confirmPassword(req, o) {
        var p = Object.extend({ text: 'Confirm password: ', name: 'Password', type: 'password' }, o);
        this.client.addPrompt(p, function (pwd) {
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
        var p = Object.extend({ text: 'Enter e-mail address: ', name: 'EmailAddress' }, o);
        this.client.addPrompt(p, function (email) {
            if (!validEmail.test(email)) {
                this.enterEmailAddress(req, { error: 'Invalid e-mail address.' });
            }
            else {
                this.enterRealName(Object.extend(req, { email: email }));
            }
        });
    }

    enterRealName(req, o) {
        var p = Object.extend({ text: 'Enter real name (optional): ', name: 'RealName' }, o);
        this.client.addPrompt(p, function (name) {
            this.createNewCharacter(Object.extend(req, { realName: name }));
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
            console.log('Creating new player');
            efuns.exec(this, player, () => {
                player().movePlayer('/world/sarta/square');
            });
        }
    }
}

MUD.export(Login);
