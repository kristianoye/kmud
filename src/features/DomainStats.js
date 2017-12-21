
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

class DomainStatsContainer {
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
        if (author in this.authors)
            return this.authors[author];
        if (createIfMissing)
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
        if (domain in this.domains)
            return this.domains[author];
        if (createIfMissing)
            return this.domains[domain] = new DomainStats();
        return false;
    }
}

module.exports = {
    DomainStats: DomainStats,
    DomainStatsContainer: new DomainStatsContainer()
};
