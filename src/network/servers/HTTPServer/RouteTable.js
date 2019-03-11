/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: Provides a simple route table interface.
 */

/// <reference path="./index.js" />

class RouteTable {
    /**
     * 
     * @param {HTTPServer} server The server this route table belongs to.
     */
    constructor(server) {

        this.controllerPath = [];
        this.routes = { length: 0 };
        this.server = server;
        this.viewPath = [];
    }

    /**
     * Add one or more entries to controller search path
     * @param {...string} expr The directories to add to the search path.
     */
    addControllerPath(...expr) {
        expr.forEach(dir => {
            if (this.controllerPath.indexOf(dir) === -1)
                this.controllerPath.push(dir);
        });
        return this;
    }

    /**
     * Add a route to the routing table.
     * @param {string} name The name of the route
     * @param {{ url: string, defaults: Object.<string,string> }} routeData Info about the route
     */
    addRoute(name, routeData) {
        if (typeof name === 'object') {
            routeData = Object.assign(name, routeData);
            name = routeData.name || 'default';
        }
        if (name in this.routes === true)
            throw new Error(`There is already a route named '${name}' in the routing table!`);

        this.routes[name] = Object.assign({
            constraints: {},
            controllerSearchPath: [],
            defaults: {},
            url: '{controller}/{action}/{id}',
            viewSearchPath: []
        }, routeData, { order: this.routes.length++ });

        return this;
    }

    /**
     * Add one or more directory to the view path
     * @param {...string} expr The path expressions to add
     */
    addViewPath(...expr) {
        expr.forEach(dir => {
            if (this.viewPath.indexOf(dir) === -1)
                this.viewPath.push(dir);
        });
        return this;
    }
}

module.exports = RouteTable;
