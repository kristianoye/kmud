const
    bcrypt = require('bcrypt');

/**
 * Config object responsible for controlling how passwords are created and used.
 */
class MUDPasswordPolicy {
    constructor(data) {
        this.allowPlainTextAuth = data.allowPlainTextAuth || false;

        /** @type {number} */
        this.minLength = data.minLength || 5;

        /** @type {number} */
        this.maxLength = data.maxLength || 100;

        /** @type {number} */
        this.requiredUpper = data.requiredUpper || 0;

        /** @type {number} */
        this.requiredLower = data.requiredLower || 0;

        /** @type {number} */
        this.requiredNumbers = data.requiredNumbers || 0;

        /** @type {number} */
        this.requiredSymbols = data.requiredSymbols || 0;

        /** @type {number} */
        this.saltRounds = data.saltRounds || 10;
    }

    assertValid() {
        if (typeof this.minLength !== 'number' || this.minLength < 0)
            throw new Error(`Invalid parameter for mud.passwordPolicy.minLength; Must be positive integer but got ${typeof this.minLength}`);
        if (typeof this.maxLength !== 'number' || this.maxLength < 0)
            throw new Error(`Invalid parameter for mud.passwordPolicy.maxLength; Must be numeric but got ${typeof this.maxLength}`);
        if (typeof this.requiredUpper !== 'number' || this.requiredUpper < 0)
            throw new Error(`Invalid parameter for mud.passwordPolicy.requiredUpper; Must be numeric but got ${typeof this.requiredUpper}`);
        if (typeof this.requiredLower !== 'number' || this.requiredLower < 0)
            throw new Error(`Invalid parameter for mud.passwordPolicy.requiredLower; Must be numeric but got ${typeof this.requiredLower}`);
        if (typeof this.requiredNumbers !== 'number' || this.requiredNumbers < 0)
            throw new Error(`Invalid parameter for mud.passwordPolicy.requiredNumbers; Must be numeric but got ${typeof this.requiredNumbers}`);
        if (typeof this.requiredSymbols !== 'number' || this.requiredSymbols < 0)
            throw new Error(`Invalid parameter for mud.passwordPolicy.requiredSymbols; Must be numeric but got ${typeof this.requiredSymbols}`);
        if (this.minLength > this.maxLength)
            throw new Error('Invalid mud.passwordPolicy; minLength must be lessthan maxLength');
        if ((this.requiredLower + this.requiredUpper + this.requiredSymbols + this.requiredNumbers) > this.minLength)
            throw new Error('Invalid mud.passwordPolicy; The sum of the required character types may not exceed the minLength');
    }

    /**
     * Check to see if the password enters matched what was previously stored.
     * @param {string} str The plain text password just entered.
     * @param {string} enc The stored, encrypted password.
     */
    checkPassword(str, enc, callback) {
        if (callback === 'function') {
            if (str === enc)
                callback(true, false);

            bcrypt.compare(str, enc, (err, same) => {
                if (err) callback(false, err);
                else callback(same, same ? false : new Error('Password mismatch'));
            });
        }
        else if (str === enc && this.allowPlainTextAuth) {
            logger.log('WARNING: Plain-text password detected!!!');
            return true;
        }
        else
            return bcrypt.compareSync(str, enc);
    }

    /**
     * 
     * @param {string} str Attempt to generate a password.
     */
    hashPasword(str, callback) {
        let checks = this.validPassword(str);
        if (typeof callback === 'function') {
            if (checks === true) {
                bcrypt.hash(str, this.saltRounds, (err, enc) => {
                    if (!err) {
                        callback(enc, []);
                    }
                });
            }
            else
                callback(null, checks);
        }
        else if (checks === true)
            return bcrypt.hashSync(str, this.saltRounds);
        else if (Array.isArray(checks) && checks.length > 0)
            throw new Error('Password policy: ' + checks.join(', '));
        else
            throw new Error('Password policy failure; No error specified!');
    }

    hashPasswordAsync(str) {
        return new Promise((resolve, reject) => {
            try {
                let checks = this.validPassword(str);
                if (checks === true) {
                    bcrypt.hash(str, this.saltRounds, (err, enc) => {
                        err ? reject(err) : resolve(enc);
                    });
                }
                else if (!Array.isArray(checks) || typeof checks[0] !== 'string') {
                    reject(new Error(`${typeof this}.validPassword() returned ${typeof checks}; Expected true|string[]`));
                }
                else {
                    let err = new Error(checks[0]);
                    err.Errors = checks;
                    reject(err);
                }
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Check to see if the password provided meets the MUD policy.
     * @param {string} str A possible password
     * @returns {true|string[]} True if the password is accepted or list if errors if not.
     */
    validPassword(str) {
        let errors = [];
        if (str.length < this.minLength) errors.push('Password is too short');
        if (str.length > this.maxLength) errors.push('Password is too long');
        if (this.requiredUpper > 0) {
            let ucc = str.replace(/[^A-Z]+/g, '').length;
            if (ucc < this.requiredUpper) errors.push(`Password must contain ${this.requiredUpper} uppercase characters.`);
        }
        if (this.requiredLower > 0) {
            let lcc = str.replace(/[^a-z]+/g, '').length;
            if (lcc < this.requiredLower) errors.push(`Password must contain ${this.requiredLower} lowercase characters.`);
        }
        if (this.requiredNumbers > 0) {
            let ncc = str.replace(/[^0-9]+/g, '').length;
            if (ncc < this.requiredNumbers) errors.push(`Password must contain ${this.requiredNumbers} numeric characters.`);
        }
        if (this.requiredSymbols > 0) {
            let scc = str.replace(/[a-zA-Z0-9]+/g, '').length;
            if (scc < this.requiredSymbols) errors.push(`Password must contain ${this.requiredSymbols} special symbols.`);
        }
        return errors.length === 0 ? true : errors;
    }
}

module.exports = MUDPasswordPolicy;
