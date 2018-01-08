/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: This module contains core game functionality.
 */
const
    FeatureBase = require('./FeatureBase'),
    DriverFeature = require('../config/DriverFeature');

class DomainStats {
    constructor() {
        /** @type {number} */
        this.arrays = 0;

        /** @type {number} */
        this.cost = 0;

        /** @type {number} */
        this.errors = 0;

        /** @type {number} */
        this.heartbeats = 0;

        /** @type {number} */
        this.moves = 0;

        /** @type {number} */
        this.objects = 0;
    }

    /**
     * @param {number} n An arbitrary amount of base currency.
     */
    addCost(n) { this.cost += n; }
}

class DomainStatsContainerType {
    constructor() {
        /** @type {Object.<string,DomainStats>} */
        this.authors = {};

        /** @type {Object.<string,DomainStats>} */
        this.domains = {};
    }

    /**
     * Returns author stats
     * @param {string} author
     * @param {boolean=} createIfMissing
     * @returns {DomainStats}
     */
    getAuthor(author, createIfMissing) {
        if (!author)
            return this.authors
        else if (author in this.authors)
            return this.authors[author];
        else if (createIfMissing)
            return this.authors[author] = new DomainStats();
        return false;
    }

    /**
     * Returns domain stats
     * @param {string} domain
     * @param {boolean=} createIfMissing
     * @returns {DomainStats}
     */
    getDomain(domain, createIfMissing) {
        if (!domain)
            return this.domains;
        else if (domain in this.domains)
            return this.domains[domain];
        else if (createIfMissing)
            return this.domains[domain] = new DomainStats();
        return false;
    }
}

const
    DomainStatsContainer = new DomainStatsContainerType();

class DomainStatsFeature extends FeatureBase {
    /**
     * @param {DriverFeature} config Config data
     */
    constructor(config, flags) {
        super(config, flags);

        this.applyNameAuthorFile = config.parameters.applyNameAuthorFile || false;
        this.applyNameDomainFile = config.parameters.applyNameDomainFile || false;
        this.driver = null;
        this.efunNameAuthorStats = config.parameters.efunNameAuthorStats || false;
        this.efunNameAddWorth = config.parameters.efunNameAddWorth || false;
        this.efunNameDomainStats = config.parameters.efunNameDomainStats || false;

        flags.authorStats = this.efunNameAuthorStats !== false;
        flags.domainStats = this.efunNameDomainStats !== false;
    }

    createDriverApplies(driver, driverProto) {

        this.driver = driver;

        if ((this.flags.authorStats = typeof this.applyNameAuthorFile === 'string')) {
            driver.applyAuthorFile = driver.masterObject[this.applyNameAuthorFile];
            if (typeof driver.applyAuthorFile !== 'function') {
                throw new Error(`In-Game Master does not contain applyNameAuthorStats apply: ${this.applyNameAuthorFile}`);
            }
            driverProto.getAuthorStats = function (filename) {
                if (this.applyAuthorFile) {
                    let author = this.applyAuthorFile.call(this.masterObject, filename);
                    return author && DomainStatsContainer.getAuthor(author, true);
                }
            };
        }
        else {
            driverProto.getAuthorStats = function (filename) { return false; };
        }

        if ((this.flags.driverStats = typeof this.applyNameDomainFile === 'string')) {
            driver.applyDomainFile = driver.masterObject[this.applyNameDomainFile];
            if (typeof driver.applyDomainFile !== 'function') {
                throw new Error(`In-Game Master does not contain applyDomainFile apply: ${this.applyNameDomainFile}`);
            }
            driverProto.getDomainStats = function (filename) {
                if (this.applyDomainFile) {
                    let domain = this.applyDomainFile.call(this.masterObject, filename);
                    return domain && DomainStatsContainer.getDomain(domain, true);
                }
            };
        }
        else {
            driverProto.getDomainStats = function (filename) { return false; };
        }
    }

    createExternalFunctions(efunProto) {
        if (this.efunNameAuthorStats) {
            if (this.applyNameAuthorFile) {
                efunProto[this.efunNameAuthorStats] = function (author) {
                    return DomainStatsContainer.getAuthor(author, false);
                };
            }
            else {
                efunProto[this.efunNameAuthorStats] = function () { throw new Error('Author stats are not enabled in driver.'); }
            }
        }

        if (this.efunNameDomainStats) {
            if (this.applyNameDomainFile) {
                efunProto[this.efunNameDomainStats] = function (domain) {
                    return DomainStatsContainer.getDomain(domain, false);
                };
            }
            else {
                efunProto[this.efunNameDomainStats] = function () { throw new Error('Domain stats are not enabled in driver.'); }
            }
        }
    }

    preCompile(module) {
        module.stats = this.driver.getDomainStats(module.filename) || this.driver.getAuthorStats(module.filename) || false;
    }
}

module.exports = DomainStatsFeature;
