/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class PasswordCommand extends Command {
    cmd(args, cmdline) {
        return this.enterPassword();
    }

    confirmPassword(pwd) {
        efuns.addPrompt({ type: 'password', text: 'Confirm new password' }, confirm => {
            if (confirm !== pwd) {
                write('Passwords did not match; Please try again.');
                this.enterPassword();
            }
            else {
                thisPlayer.setPassword(efuns.createPassword(pwd));
                write('Password changed.  Do not forget to save!');
            }
        });
    }

    enterPassword() {
        efuns.addPrompt({ type: "password", text: "Enter a new password: " }, pwd => {
            let valid = efuns.validPassword(pwd);
            if (pwd.length === 0) {
                write('Exiting; Password was not changed.');
                return false;
            }
            else if (Array.isArray(valid)) {
                write(valid.join('\n'));
                return true;
            }
            else this.confirmPassword(pwd);
        });
        return true;
    }
}

module.exports = new PasswordCommand();
