const
    originalCatch = Promise.prototype.catch;

Promise.prototype.abort = function () {
    this.isAborted = true;
};

Promise.prototype.catch = function (handler) {
    let args = [].slice.apply(arguments);
    args[0] = err => {
        err = driver ? driver.cleanError(err) : err;
        return handler(err);
    };
    return originalCatch.apply(this, args);
};

Promise.prototype.always = function (onResolveOrReject) {
    return this.then(onResolveOrReject, reason => {
        onResolveOrReject(reason);
        throw reason;
    });
};

/**
 * 
 * @param {Promise[]} taskList
 * @param {any} limit
 */
Promise.allWithLimit = async (taskList, limit = 5) => {
    const iterator = taskList.entries();
    let results = new Array(taskList.length);
    let workerThreads = new Array(limit).fill(0).map(() => 
        new Promise(async (resolve, reject) => {
            try {
                let entry = iterator.next();
                while (!entry.done) {
                    let [index, promise] = entry.value;
                    try {
                        results[index] = await promise;
                        entry = iterator.next();
                    }
                    catch (err) {
                        results[index] = err;
                    }
                }
                // No more work to do
                resolve(true); 
            }
            catch (err) {
                // This worker is dead
                reject(err);
            }
        }));

    await Promise.all(workerThreads);
    return results;
};
