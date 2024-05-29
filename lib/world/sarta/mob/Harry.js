/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * A nod to LPMud 2.4.5 and Lars Pensjö
 */

import { LIB_NPC } from '@Base';
import NPC from LIB_NPC;

export default class Harry extends NPC {
    override create() {
        super.create();
        this.shortDesc = 'Harry the Affectionate';
        this.name = 'harry';
        this.setKeyId('harry');
        this.setCapName('Harry');
        this.idList = ['harry', 'man'];
        this.adjectives =  ['friendly', 'affectionate'];
        this.longDesc = 'Harry has an agreeable look.';
        this.gender = 'male';
        this.setActions(15,
            '',
            '!smile hap',
            '',
            '!say What are you waiting for?',
            '',
            '!say Hello there!',
            '',
            "!say I don't like winter",
            '',
            "!say I don't like snow",
            '',
            "!say I don't like rain",
            '',
            "!say Who are you?",
            '',
            "!say Why do you look like that?",
            '',
            "!say What are you doing here?",
            '',
            "!say Nice weather, isn't it?",
            '',
            '@smileAtRandomPerson');
        this.setCombatActions(25,
            "!say Don't hit me!",
            '',
            "!say That hurt!",
            '',
            "!say Help, someone!",
            '',
            "!say Why can't you go bullying elsewhere?",
            '',
            "!say Aooooo",
            '',
            "!say I hate bashers!",
            '',
            "!say Bastard!",
            '',
            "!say You big brute!");
    }

    /**
     * 
     * @param {string} messageType
     * @param {string} message
     */
    receiveMessage(messageType, message) {
        let verb = efuns.queryVerb(),
            verbs = efuns.pluralize(verb),
            name = thisPlayer().displayName;

        if (message.endsWith('.'))
            message = message.slice(0, message.length - 1);

        switch (messageType) {
            case 'secondPerson':
                switch (verb) {
                    case 'smile':
                        setTimeout(async () => {
                            await efuns.command(`smile hap at ${name.toLowerCase()}`);
                        }, 2000);
                        break;

                    default:
                        let x = message.indexOf(verb),
                            s = (x > -1 ? message.slice(x) : message)
                                .replace('you', 'me')
                                .replace(verbs, verb);
                        efuns.command(`say Why did you ${s}, ${name}?`);
                        break;
                }
                break;

            case 'thirdPerson':
                break;
        }
    }

    async smileAtRandomPerson() {
        let livings = this
            .environment
            .inventory
            .filter(o => efuns.living.isAlive(o) && o !== this);

        if (livings.length > 0) {
            let keyId = livings[efuns.random(0, livings.length)].keyId;
            efuns.command(`smile hap at ${keyId}`);
        }
    }
}
