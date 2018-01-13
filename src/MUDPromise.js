
/**
 * 
 * @param {function(Function,Function):any} action
 * @param {function(any):any} success
 * @param {function(Error):any} failure
 */
function tryFunctionCall(action, success, failure) {
    try {
        return action(success, failure);
    }
    catch (err) {
    }
}

/**
 * 
 * @param {any} action
 */
function performAction(action) {
    let done = false, result = tryFunctionCall.call(this, action,
        (result) => {
            if (!done) {
                done = true;
            }
        },
        (error) => {
            if (!done) {
                done = true;
            }
        });
}

class MUDPromise {
    /**
     * Create an A+ MUD Promise
     * @param {function(Function,Function):MUDPromise} action The async action to wrap.
     */
    constructor(action) {
        this.state = 0;
        this.action = action;
        this.thens = [];

        performAction.call(this, action);
    }

    then(onSuccess, onFailure) {

    }
}

let test = new MUDPromise((resolve, reject) => {
    let m = parseFloat(Math.random() * 100.0);
    return m > 50 ? resolve(m) : reject(new Error('Under 50'));
});