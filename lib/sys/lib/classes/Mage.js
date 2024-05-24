/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import { LIB_CHARCLASS } from '@Base';
import CharacterClass from LIB_CHARCLASS;

export default singleton class MageClass extends CharacterClass {
    override create() {
        super.create();
        this.className = 'Mage';
        this.channelName = 'mage';
        this.minStats = {
            'intelligence': 12
        };
    }
}
