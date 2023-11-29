/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

export default abstract class Put {
    directPutObjectInObject(target, container) {
        return (this.environment !== container);
    }
}

