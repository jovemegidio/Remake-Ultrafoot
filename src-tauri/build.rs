fn main() {
    // Regera os recursos de versão do executável sempre que o manifesto Tauri
    // muda; evita instalador novo contendo FileVersion da build anterior.
    println!("cargo:rerun-if-env-changed=TAURI_CONFIG");
    // ⚠️ SEM ISTO O BUILD DE LOJA SAI ERRADO E EM SILENCIO. `option_env!` e
    // resolvido na compilacao; o cargo, sozinho, nao sabe que o valor mudou e
    // reaproveita o objeto anterior. O resultado seria um binario "de loja"
    // que se acha da venda direta — pedindo codigo de serie a quem comprou na
    // Steam, e sem nenhum erro para denunciar.
    println!("cargo:rerun-if-env-changed=ULTRAFOOT_LOJA");
    #[cfg(target_os = "windows")]
    {
        cc::Build::new()
            .cpp(true)
            .std("c++17")
            .flag_if_supported("/EHsc")
            .include("vendor/discord-social-sdk/include")
            .file("src/discord_social_bridge.cpp")
            .compile("ultrafoot_discord_social_bridge");
        println!("cargo:rustc-link-search=native=vendor/discord-social-sdk/lib");
        println!("cargo:rustc-link-lib=dylib=discord_partner_sdk");
        println!("cargo:rerun-if-changed=src/discord_social_bridge.cpp");
        println!("cargo:rerun-if-changed=vendor/discord-social-sdk/include/discordpp.h");
    }
    tauri_build::build()
}
