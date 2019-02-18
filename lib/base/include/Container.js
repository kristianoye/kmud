/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 18, 2017
 * 
 * Constant key properties for container objects.
 */

module.exports = Object.freeze({
    //  The container multiplier dictates the relative weight of the items 
    //  in the container.  The standard is 1:1, or 1.00, which means each 
    //  item in the container adds one unit of weight for every unit of 
    //  weight added.  A bag of holding might have a multiplier of 0.10 
    //  which means items in the bag weigh 10% of normal.
    CONTAINER_MULTIPLIER: 'container/multiplier'
});