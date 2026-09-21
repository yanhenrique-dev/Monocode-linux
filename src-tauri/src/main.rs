fn main() {
    if std::env::args().nth(1).as_deref() == Some("control") {
        std::process::exit(monocode_lib::control_cli::run(
            std::env::args().skip(2).collect(),
        ));
    }
    monocode_lib::run()
}
