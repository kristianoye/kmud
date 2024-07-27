/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

/**
 * @typedef {Object} PlayableObject
 * @property {string} playerName
 * @property {string} playerFile
 * @property {string} playerRace
 * @property {number} lastPlayed
 * @property {string} displayText
 * @property {boolean} enabled
 * @property {string} gender
 * @property {string} disabledReason
 * @property {boolean} isCreator
 * 
 * @typedef {Object} AccountObject
 * @property {string} accountName
 * @property {boolean} banned
 * @property {number} createDate
 * @property {number} lastLogin
 * @property {string} emailAddress
 * @property {string} password
 * @property {PlayableObject[]} players
 * @property {string} realName
 * @property {boolean} require2FA
 */

import { ACCOUNT_D, PLAYER_D, RACE_D } from '@Daemon';
import { InputTypes as Inputs } from '@InputTypes';
import { FILE_TEXTSPLASH } from '../include/DataFiles';

const
    validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    AccountDaemon = await efuns.loadObjectAsync(ACCOUNT_D),
    PlayerDaemon = await efuns.loadObjectAsync(PLAYER_D),
    RaceDaemon = await efuns.loadObjectAsync(RACE_D),
    LoginTimeout = efuns.time.timespan('10 minutes');

class TextLogin extends MUDObject {
    /**
     * Displays characters that are registered on the account 
     * @param {AccountObject} accountData
     */
    private characterSelectionScreen(accountData) {
        let output = '',
            noPlayers = accountData.players.length === 0;

        if (noPlayers) {
            writeLine('\nYou do not currently have any characters; You must create a new character to continue.\n');
            return this.createNewCharacter(accountData);
        }
        
        output += `\nWhich of your characters would you like to log in as?  Type 'new' to create a new character.\n\n`;
        output += '          ' + 'Player'.padRight(18) + 'Description:\n';
        output += '-='.repeat(30) + '-\n';

        let c = 1;

        for (const pc of accountData.players) {
            output += '\n    ';
            output += ((c++).toString() + ')').padRight(3);
            output += ' ' + pc.playerName.padRight(18);
            output += pc.displayText;
        }

        let opts = Object.assign({
            text: `\nSelect your player or type 'new': `,
            maxLength: 15,
            maxLengthError: 'Your player name cannot exceed 15 characters'
        });

        writeLine(output);

        prompt(Inputs.InputTypeText, opts, async playerName => {
            if (playerName === 'new') {
                this.createNewCharacter(accountData);
            }
            else if (playerName === 'help') {
                writeLine('\n' +
                    `Type 'new' to create a new character.\n` +
                    `Type 'quit' to disconnect from the MUD.\n` +
                    `Type 'help' to this helpful text.\n` +
                    `Type the name--or part of the name--of one of your characters to log in.\n`);
                return true;
            }
            else if (playerName == 'quit') {
                await this.disconnect();
            }
            else {
                let numericChoice = parseInt(playerName),
                    choices = isNaN(numericChoice) ?
                        accountData.players.filter(pc => pc.playerName.startsWith(playerName)) :
                        accountData.players.slice(numericChoice - 1, numericChoice);


                if (choices.length === 0) {
                    writeLine(`\nCould not find any players matching '${playerName}'\n`);
                    return this.characterSelectionScreen(accountData);
                }
                else if (choices.length > 1) {
                    let possibleChoices = choices.map(pc => `'${pc.name}'`),
                        lastChoice = possibleChoices.pop(),
                        choiceText = possibleChoices.join(', ') + ' or ' + lastChoice;

                    writeLine(`\nAmbiguous character selection '${playerName}'; Could be ${choiceText}\n`);
                    return this.characterSelectionScreen(accountData);
                }
                else if (!choices[0].enabled) {
                    if (choices[0].disabledReason) {
                        writeLine(`\nPlayer '${choices[0].playerName}' is not available: ${choices[0].disabledReason}`);
                    }
                    else {
                        writeLine(`\nPlayer '${choices[0].playerName}' is not available\n`);
                    }
                    return this.characterSelectionScreen(accountData);
                }
                else {
                    try {
                        let player = await PlayerDaemon().findOrLoadPlayer(choices[0].playerName, choices[0].isCreator === true);
                        if (player)
                            await efuns.unguarded(async () => {
                                await efuns.exec(this, player, async () => {
                                    await player->movePlayerAsync(player.environment || '/world/sarta/Square');
                                });
                            });
                    }
                    catch (err) {
                        writeLine(`\nPlayer '${choices[0].playerName}' is not available [ERROR]\n`);
                        return this.characterSelectionScreen(accountData);
                    }
                }
            }
        });
    }

    private confirmPassword(accountInfo) {
        prompt(Inputs.InputTypePassword, 'Confirm password: ', pwd => {
            if (accountInfo.plain !== pwd) {
                writeLine('\nPasswords do not match; Please try again.\n\n');
                this.createPassword(accountInfo);
            }
            else {
                delete accountInfo.plain;
                this.enterEmailAddress(accountInfo);
            }
        });
    }

    /**
     * Confirm choices and create new character
     * @param {AccountObject} account
     * @param {PlayableObject} player
     */
    private confirmNewPlayer(account, player) {
        let output = 'Please review and confirm the details of your new character.\n\n';

        output += `Player name:     ${player.playerName}\n`;
        output += `Player race:     ${player.playerRace}\n`;
        output += `Player gender:   ${player.gender}\n`;
        if (player.isCreator) {
            output += 'Player type:     Immortal/Creator\n';
        }
        writeLine(output + '\n');
        return prompt(Inputs.InputTypeYesNo, `Does everything look correct? `, async resp => {
            if (resp === 'yes') {
                let newPlayer = await AccountDaemon().createNewCharacter(account, player);
                if (!newPlayer) {
                    return await this.disconnect(`Unable to create '${player.playerName}' due to an error!  Please try back later.`);
                }
                else {
                    await efuns.unguarded(async () => {
                        await efuns.exec(this, newPlayer, async () => {
                            await newPlayer.instance.movePlayerAsync('/world/sarta/Square');
                        });
                    });
                }
            }
            else {
                writeLine('\n\nReturning to previous step.\n');
                if (PlayerDaemon().autowizAvailable(this.portNumber, this.remoteAddress))
                    return this.selectPlayerType(account, player);
                else
                    return this.selectGender(account, player);
            }
        });
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

    /**
     * Create a new account
     */
    private createNewAccount() {
        let opts = Object.assign({
            text: 'Enter desired account name: ',
            maxLength: 20,
            maxLengthError: 'Your account cannot exceed 20 characters',
            minLength: 3,
            minLengthError: 'Your account must be at least 3 characters'
        });

        prompt(Inputs.InputTypeText, opts, async accountName => {
            if (accountName === 'back') {
                return this.enterAccountName();
            }
            else if (accountName === 'quit') {
                await this.disconnect();
            }
            else if (await AccountDaemon().accountExists(accountName)) {
                return writeLine(`Account '${accountName}' already exists; Please pick another or type 'back'.`);
            }
            else {
                let confirm = await promptAsync(Inputs.InputTypeYesNo, { text: `Confirm: You wish for '${accountName}' to be your account name? `, default: 'yes' });
                if (confirm === 'yes') {
                    return this.createPassword({ accountName });;
                }
                else {
                    writeLine('\nPlease enter a different account name, then, or type "quit" to disconnect.\n\n');
                    return true; // Recapture
                }
            }
        });
    }

    /**
     * Create a new character
     * @param {AccountObject} account
     */
    private createNewCharacter(account) {
        let opts = Object.assign({
            text: 'Enter new character name: ',
            maxLength: 15,
            maxLengthError: 'Your player name cannot exceed 15 characters',
            minLength: 3,
            minLengthError: 'Your player name must be at least 3 characters'
        });

        prompt(Inputs.InputTypeText, opts, async playerName => {
            if (playerName === 'back') {
                return this.characterSelectionScreen(account);
            }
            else if (playerName === 'quit') {
                await this.disconnect();
            }
            else if (await PlayerDaemon().playerExistsAsync(playerName)) {
                return writeLine(`Player '${playerName}' already exists; Please try another name.`);
            }
            else {
                let confirm = await promptAsync(Inputs.InputTypeYesNo, { text: `Confirm: You wishh '${playerName}' to be new player name? `, default: 'yes' });
                if (confirm === 'yes') {
                    return this.selectRace(account, { playerName });
                }
                else {
                    writeLine('\nPlease enter a different name, then.\n\n');
                    return true; // Recapture
                }
            }
        });
    }

    /**
     * Select a password for a new account
     * @param {AccountObject} accountInfo
     */
    private createPassword(accountInfo) {
        prompt(Inputs.InputTypePassword, 'Select a password: ', async plain => {
            let errors, password = await efuns.createPasswordAsync(plain)
                .catch(e => { errors = e });
            if (!errors)
                return this.confirmPassword(Object.assign(accountInfo, { password, plain }));
            else if (!Array.isArray(errors.list)) {
                writeLine(`\n${errors.message}\n\n`);
                return this.createPassword(accountInfo);
            }
            else {
                writeLine(`\n${errors.list.join('\n')}\n\n`);
                return this.createPassword(accountInfo);
            }
        });
    }

    /**
     * Initiates the login process for a newly connected telnet client.
     * @param {number} portNumber
     * @param {string} remoteAddress
     */
    private async connect(portNumber, remoteAddress) {
        this.portNumber = portNumber;
        this.remoteAddress = remoteAddress;

        let splash = await efuns.fs.readFileAsync(FILE_TEXTSPLASH);
        efuns.living.enableHeartbeat(true);
        writeLine(splash);
        this.enterAccountName();
    }

    /**
     * Disconnect from the MUD
     * @param {string} reason
     */
    private async disconnect(reason = undefined) {
        typeof reason === 'string' && writeLine(reason);
        await efuns.destruct(this);
    }

    /**
     * Prompt the user to enter their account name
     */
    private enterAccountName() {
        let opts = Object.assign({
            text: 'Enter your account name (type "new" to create an account): ',
            maxLength: 20,
            maxLengthError: 'Your account name cannot exceed 20 characters',
            minLength: 3,
            minLengthError: 'Your account name must be at least 3 characters'
        });

        prompt(Inputs.InputTypeText, opts, async accountName => {
            if (accountName.length === 0 || accountName === 'quit') {
                await this.disconnect();
            }
            else if (accountName === 'new') {
                this.createNewAccount();
            }
            else if (!await AccountDaemon().accountExists(accountName)) {
                writeLine(`\nAccount '${accountName}' does not exist on this MUD.\n\n`);
                return true;
            }
            else {
                this.enterPassword(accountName);
            }
        });
    }

    /**
     * Enter password for an existing account
     * @param {string} accountName The account being logged into
     */
    private enterPassword(accountName) {
        prompt(Inputs.InputTypePassword, 'Enter password: ', async pwd => {
            if (pwd.length === 0) {
                await this.disconnect('Password is required!');
            }
            else {
                let result = await AccountDaemon().authenticate(accountName, pwd);
                if (typeof result !== 'object') {
                    writeLine('\nPassword incorrect!\n');
                    return true; // Recapture
                }
                else {
                    this.characterSelectionScreen(result);
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
                let playerObject = await PLAYER_D->findOrLoadPlayer(name);

                if (!playerObject) {
                    //return this.confirmUsername(name);
                    let confirm = await promptAsync(Inputs.InputTypeYesNo, { text: `Is ${name} the name you really want? `, default: 'yes' });
                    if (confirm === 'yes') {
                        return this.selectPassword({ name });;
                    }
                    else {
                        writeLine('\nEnter the name you really want, then.\n\n');
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

    private get portNumber() {
        return get(-1);
    }

    private set portNumber(n) {
        if (typeof n === 'number')
            set(n);
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

    /**
     * Select new player gender
     * @param {AccountObject} account
     * @param {PlayableObject} player
     */
    private selectGender(account, player) {
        let opts = {
            text: 'Select a gender for your character: ',
            type: 'pickOne',
            options: {
                m: 'male',
                f: 'female',
                h: 'hermaphrodite',
                n: 'neutar',
                o: 'other',
                q: 'quit',
                b: 'back'
            },
            summary: ',',
            prompt: 'Character Type'
        };
        prompt(Inputs.InputTypePickOne, opts, async gender => {
            if (gender) {
                if (gender === 'back') {
                    return this.selectRace(account, player);
                }
                else if (gender === 'quit') {
                    return await this.disconnect();
                }
                player.gender = gender;
                player.enabled = true;

                if (PlayerDaemon().autowizAvailable(this.portNumber, this.remoteAddress)) {
                    return this.selectPlayerType(account, player);
                }
                else {
                    return this.confirmNewPlayer(account, player);
                }
            }
            else {
                writeLine('\nInvalid gender choice; Please try again (you can change later)\n\n');
                this.selectGender(playerData);
            }
        });
    }

    private displayRaceHelp(raceName) {
        let helpText = '\n' + RaceDaemon().getRaceHelp(raceName);
        writeLine(helpText);
    }

    /**
     * If autowiz is enabled for this client, let them decide what type of character to create.
     * @param {AccountObject} account
     * @param {PlayableObject} player
     */
    private selectPlayerType(account, player) {
        writeLine('The AutoWiz feature is available to you.  This means you may either create' +
            ' 1) an immortal creator, a.k.a.wizard, or, 2) a normal player.');

        let opts = {
            text: 'Select type of character: ',
            type: 'pickOne',
            options: {
                i: 'immortal',
                p: 'player',
                q: 'quit',
                b: 'back'
            },
            summary: ',',
            prompt: 'Gender'
        };
        prompt(Inputs.InputTypePickOne, opts, async choice => {
            switch (choice) {
                case 'back':
                    return this.selectGender(account, player);

                case 'quit':
                    return await this.disconnect();

                case 'immortal':
                    player.isCreator = true;
                    return this.confirmNewPlayer(account, player);

                case 'player':
                    player.isCreator = false;
                    return this.confirmNewPlayer(account, player);
            }
            return true;
        });
    }

    /**
     * Select the race for a new player
     * @param {AccountObject} account
     * @param {PlayableObject} player
     */
    private selectRace(account, player) {
        /** @type {string[]} */
        let raceList = RaceDaemon().getPlayerRaces(),
            output = '';

        output += '\nSelecting a biological race is the first step in creating a new character.  Each ' +
            'race comes with its own strengths and weaknesses.  You may type \'help\' [race] to read ' +
            'more information about a particular option.  Please choose from the following list: \n\n';

        output += efuns.columnText(raceList.map((name, i) => `${(i + 1)}) ${name}`), undefined, 5);
        writeLine(output);
        prompt(Inputs.InputTypeText, '\nSelect player race: ', async playerRace => {
            if (playerRace === 'back') {
                return this.createNewCharacter(account);
            }
            else if (playerRace === 'quit') {
                return await this.disconnect();
            }
            else {
                let n = parseInt(playerRace);
                if (isNaN(n)) {
                    let helpCheck = /help\s*(?<arg>.+)?/,
                        m = helpCheck.exec(playerRace);

                    if (m) {
                        if (m.groups.arg) {
                            n = parseInt(m.groups.arg);
                            if (isNaN(n)) {
                                let search = m.groups.arg,
                                    subject = raceList.filter(r => r.startsWith(search));

                                if (subject.length === 0) {
                                    writeLine(`\nTerm '${search}' does not match any races; Please try again.\n\n`);
                                }
                                else {
                                    for (const race of subject) {
                                        this.displayRaceHelp(race);
                                    }
                                }
                                return this.selectRace(account, player);
                            }
                            else {
                                if (--n < 0 || n >= raceList.length) {
                                    writeLine(`\nTerm '${search}' does not match any races; Please try again.\n\n`);
                                    return this.selectRace(account, player);
                                }
                                else {
                                    this.displayRaceHelp(raceList[n]);
                                    return this.selectRace(account, player);
                                }
                            }
                        }
                        else {
                            writeLine('You may select a playable race either by, 1) typing the name, or, 2) typing the ' +
                                ' number associated with the race.  You may also type \'back\' to go back and change' +
                                ' your character name, or may type \'quit\' to disconnect.');
                            return this.selectRace(account, player);
                        }
                    }
                    else {
                        let search = raceList.filter(r => r.startsWith(playerRace));

                        if (search.length === 0) {
                            writeLine(`\nTerm '${search}' does not match any races; Please try again.\n\n`);
                            return this.selectRace(account, player);
                        }
                        else if (search.length > 1) {
                            search = search.map(r => `'${r}'`);
                            let lastRace = search.pop(),
                                couldBe = search.join(', ') + ' or ' + lastRace;

                            writeLine(`\nTerm '${search}' is ambiguous; Could be ${couldBe}.\n\n`);
                            return this.selectRace(account, player);
                        }
                        else {
                            player.playerRace = search[0];
                            return this.selectGender(account, player);
                        }
                    }
                }
                else {
                    if (--n < 0 || n >= raceList.length) {
                        writeLine(`\n${n} is not a valid selection; Please try again.\n\n`);
                        return this.selectRace(account, player);
                    }
                    else {
                        player.playerRace = raceList[n];
                        return this.selectGender(account, player);
                    }
                }
            }
            return this.selectRace(account, player);
        });
    }

    private enterEmailAddress(accountInfo) {
        prompt('text', 'Enter a valid e-mail address: ', emailAddress => {
            if (!validEmail.test(emailAddress)) {
                writeLine('\nInvalid email address\n\n');
                this.enterEmailAddress(accountInfo);
            }
            else {
                this.enterRealName(Object.assign(accountInfo, { emailAddress }));
            }
        });
    }

    private enterRealName(accountInfo) {
        prompt('text', 'Enter real name (optional; Prefix with # to keep it private): ', async realName => {
            let result = await AccountDaemon().createAccount(accountInfo);
            if (typeof result === 'object') {
                this.characterSelectionScreen(result);
            }
            else {
                writeLine(`\nUnable to create an account.  Something must have gone wrong.\n\n`);
                this.enterAccountName();
            }
        });
    }

    private get remoteAddress() {
        return get('');
    }

    private set remoteAddress(addr) {
        if (typeof addr === 'string')
            set(addr);
    }
}

module.defaultExport = TextLogin;

