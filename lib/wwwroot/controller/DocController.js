
class DocController extends MudHttpController {
    constructor() {
        super([
            [Authorized],
            Route("/api/docs/GetModuleHelp"),
            "GetModuleHelp",
            () => {
                this.name
            }
        ]);
    }

    name() {
        return 'Doc';
    }
}