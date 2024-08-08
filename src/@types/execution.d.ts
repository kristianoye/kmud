declare module 'execution' {
    global {
        interface IExecutionContext {
            pushFrameObject(): void;
        }
    }
}