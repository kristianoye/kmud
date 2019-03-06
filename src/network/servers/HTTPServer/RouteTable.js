/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Provides a simple route table interface.
 */

class RouteTable {
    constructor() {
        this.routes = {};
    }

    /**
     * Add a route to the routing table.
     * @param {string} name The name of the route
     * @param {{ url: string, defaults: Object.<string,string> }} routeData Info about the route
     */
    addRoute(name, routeData) {
        if (name in this.routes === true)
            throw new Error(`There is already a route named '${name}' in the routing table!`);
        this.routes[name] = Object.assign({
            defaults: {},
            url: '{controller}/{action}/{id}'
        }, routeData);
    }


}

module.exports = RouteTable;
