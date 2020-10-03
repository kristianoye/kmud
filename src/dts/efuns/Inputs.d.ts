declare enum InputType {
    /** The user must decide whether to abort, retry, or fail */
    AbortRetryFail = 'abort-retry-fail',
    /** Render an entire form of inputs to the user */
    Form = 'form',
    /** Request the next line of input from the user */
    Text = 'text',
    /** Request the next line of input from the user but do not echo the characters */
    Password = 'password',
    /** Pick one option from a list */
    PickOne = 'pickone',
    /** Simple binary selection */
    YesNo = 'yes-no',
    /** Yes, no, or cancel */
    YesNoCancel = 'yes-no-cancel'
}

namespace Helpers {
    /** Helpers to collect info from user */
    interface Inputs {
        /**
         * Render a prompt for the user and redirect the response to the specified callback
         * @param type The type of input to render
         * @param options Additional options to pass to the 
         * @param callback
         */
        addPrompt(type: InputType, options: any, callback: (input: string) => void): void;
    }
}
