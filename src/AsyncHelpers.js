
Array.prototype.forEachAsync = async (callback) => {
    if (!driver.efuns.isAsync(callback))
        throw new Error('Bad argument 1 to forEachAsync(): Callback must be async');
    let promises = [];
    for (let i = 0; i < this.length; i++) {
        promises.push(callback(this[i], i));
    }
    return await Promise.all(promises);
};
