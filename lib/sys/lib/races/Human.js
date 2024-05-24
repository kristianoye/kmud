/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

import { LIB_RACE } from '@Base';
import CharacterRace from LIB_RACE;

export default singleton class HumanRace extends CharacterRace {
    protected async override create() {
        super.create();
        this.setRaceName('human')
            .setHealthModifier(1.0)
            .enablePlayerRace(true);
        await this.setBodyType('human')
    }
}
