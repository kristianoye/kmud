/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

export default singleton class PasswordCommand extends Command {
    override cmd(args, cmdline) {
        return this.enterPassword();
    }

    confirmPassword(pwd) {
        prompt('password', 'Confirm new password: ', confirm => {
            if (confirm !== pwd) {
                writeLine('Passwords did not match; Please try again.');
                this.enterPassword();
            }
            else {
                thisPlayer().setPassword(efuns.createPassword(pwd));
                writeLine('Password changed.  Do not forget to save!');
            }
        });
    }

    enterPassword() {
        prompt('password', 'Enter a new password: ', pwd => {
            let valid = efuns.validPassword(pwd);
            if (pwd.length === 0) {
                writeLine('Exiting; Password was not changed.');
                return false;
            }
            else if (Array.isArray(valid)) {
                writeLine(valid.join('\n'));
                return true;
            }
            else this.confirmPassword(pwd);
        });
        return true;
    }
}
