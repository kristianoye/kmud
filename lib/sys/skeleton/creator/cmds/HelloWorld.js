
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

class HelloWorld extends Command {
    cmd() {
        return writeLine('Hello World');
    }
}